# Chat — Emojis + Imagens/Arquivos no composer (CHAT-02 restante) — Design

> Fecha os dois sub-projetos que faltavam do guarda-chuva CHAT-02 (decomposto no
> brainstorm). Já prontos e mergeados na main: typing, leitura (✓✓), envio (✓),
> apagar mensagem (CHAT-01), sair/arquivar conversa, presença/visto por último.
> Feito num spec só porque ambos enriquecem o mesmo composer de mensagens.

## Contexto: o que já existe

- Chat no **Firebase Realtime Database (RTDB)**. Mensagem:
  `{ senderId, receiverId, content, audioUrl, read, createdAt, deleted? }`.
- **Composer** (`frontend/src/pages/Chat/index.jsx`): textarea controlado
  (`input`/`setInput`) + botão de áudio (grava via `useAudioRecorder`, mostra
  preview com player + enviar/descartar) + botão de enviar.
- **Pipeline de upload de áudio** (o padrão a reusar): `POST /messages/audio`
  → multer disk storage (`backend/src/config/upload.js`, força `.webm`, aceita
  só áudio, limite 10MB) → `createMessage({ audioUrl: '/uploads/{filename}' })`
  no RTDB. A pasta `backend/uploads/` é servida publicamente por
  `app.use('/uploads', express.static(...))` (`backend/server.js:107`) — sem
  auth, nomes com hash aleatório.
- **Render** (`Chat/index.jsx`, no `.map` das mensagens): `audioUrl` → `<audio>`;
  senão → texto (`content`). Já há o ramo de tombstone (`deleted`).
- `createMessage` (`backend/src/services/chatRealtimeService.js`) aceita
  `{ senderId, receiverId, content, audioUrl = null }`.

## Decisões (tomadas com o usuário)

1. **Storage: disco local via multer** (reusa o pipeline do áudio). Sem Firebase
   Storage/Blaze. Limitação conhecida: some em deploy efêmero — mesma do áudio.
2. **Emojis: picker próprio simples, sem dependência npm** (~48 emojis comuns
   num grid). Sem busca.
3. **Anexos: imagens + PDF.** Imagens (JPG/PNG/WEBP/GIF) inline; PDF como card
   com link de download. Sem tipos arbitrários.
4. Um anexo por mensagem, sem legenda de texto junto (YAGNI).

## Modelo de dados

A mensagem RTDB ganha 3 campos planos (o `audioUrl` legado fica como está):

```
{ ...campos atuais, attachmentUrl, attachmentType: 'image' | 'pdf', attachmentName }
```

- `attachmentUrl`: `/uploads/{timestamp}-{hash}.{ext}`.
- `attachmentType`: `'image'` ou `'pdf'`.
- `attachmentName`: nome original do arquivo (truncado ~120 chars), só para
  exibição.

## Backend

### Upload de anexo (novo pipeline, separado do áudio)

- **`backend/src/config/uploadAttachment.js`** — multer disk storage em
  `backend/uploads/`, filename `{timestamp}-{hash}.{ext}` **preservando a
  extensão original** (o áudio força `.webm`, por isso não dá pra reusar).
  `fileFilter` aceita `image/jpeg`, `image/png`, `image/webp`, `image/gif`,
  `application/pdf`. Limite **5MB** (`5 * 1024 * 1024`), `files: 1`. Erros de
  tipo/tamanho viram status limpos (413/422), como o wrapper do áudio já faz.
- **`backend/src/utils/attachment.js`** — helper puro
  `attachmentTypeFor(mimetype)` → `'image' | 'pdf' | null`. É o núcleo testável
  (usado pelo controller pra derivar o `attachmentType`).

### Service + controller + rota

- **`createMessage`** (chatRealtimeService) passa a aceitar
  `{ attachmentUrl = null, attachmentType = null, attachmentName = null }` ao
  lado do `audioUrl`, gravando-os no nó da mensagem.
- **`sendAttachmentMessage`** (controller, espelha `sendAudioMessage`): valida o
  arquivo presente; deriva `attachmentType` via `attachmentTypeFor(file.mimetype)`
  (se `null`, 422); monta `attachmentUrl = '/uploads/{file.filename}'` e
  `attachmentName` (originalname truncado); chama `createMessage` com
  `content: ''`. Responde `201 { message }`.
- **Rota** `POST /messages/attachment` (multer wrapper + `checkToken`), registrada
  em `backend/src/routes/messageRoutes.js` junto das demais de mensagem.

### Segurança

`/uploads` continua público com nome-hash (mesma postura do áudio hoje). O
`fileFilter` (mimetype) barra fora da whitelist. O `attachmentName` é só exibição
(React escapa no render); o filename no disco é gerado pelo servidor (hash + ext),
nunca vem do nome do usuário → sem path traversal. Aceito no MVP (mesmo nível do
áudio existente).

## Frontend

### Emoji picker

- **`frontend/src/components/EmojiPicker.jsx`** — botão 😀 no composer abre um
  popover com um grid de ~48 emojis comuns (lista curada num const no próprio
  arquivo). Props: `onSelect(emoji)`. Clicar num emoji chama `onSelect` e fecha o
  popover. Sem dependência npm, sem busca. Fecha ao clicar fora / ESC.
- No Chat: `onSelect={(e) => setInput((v) => v + e)}` (append no fim, mantém o
  foco no textarea).

### Anexo (imagem/PDF) no composer

- Um botão 📎 no composer aciona um `<input type="file" accept="image/*,application/pdf">`
  oculto (via ref). Ao escolher, guarda o arquivo em estado (`pendingFile`) e
  mostra um **preview inline** no composer — miniatura para imagem
  (`URL.createObjectURL`) / nome + ícone para PDF — com botões **enviar** e
  **cancelar**, no mesmo lugar/estilo do preview de áudio atual.
- **Validação client** (antes de enviar, espelha o backend): mimetype na
  whitelist e tamanho ≤ 5MB; senão `toast` e não envia.
- Enviar → `POST /messages/attachment` com `FormData` (`file` + `receiverId`),
  como o áudio faz; adiciona a mensagem retornada ao estado, dispara o
  `notify_message` do socket, limpa o `pendingFile`.

### Render das mensagens

No `.map` do Chat, junto do ramo `audioUrl`:
- `attachmentType === 'image'` → `<img src={API_URL + attachmentUrl}>` (max-width,
  cantos arredondados, clicável → abre `attachmentUrl` em nova aba no tamanho
  cheio).
- `attachmentType === 'pdf'` → um card: ícone de PDF + `attachmentName` + link
  "abrir" (`href={API_URL + attachmentUrl}`, `target=_blank`, `rel=noreferrer`).
- `audioUrl` → player (existente); senão → texto.

## Testes

- **Backend (`node --test`):** `attachmentTypeFor(mimetype)` — imagem/*→'image',
  application/pdf→'pdf', outros→null. É o núcleo de validação. O `createMessage`
  estendido é mecânico; **não** recrio o fake RTDB (ele existe na base agora que
  a main tem o chat-features mergeado — `backend/tests/helpers/fakeRtdb.js`), mas
  a cobertura de `createMessage` com anexo pode reusá-lo se conveniente. A regra
  mínima: suíte continua verde.
- **Frontend (`vitest`):**
  - `EmojiPicker` — abrir o grid, clicar num emoji chama `onSelect` com o emoji.
  - No harness do Chat — escolher um arquivo mostra o preview; enviar chama
    `api.post('/messages/attachment', FormData)`; validação client (arquivo
    grande/tipo errado → toast, sem envio).
  - Render — `attachmentType:'image'` renderiza `<img>` com o src certo;
    `attachmentType:'pdf'` renderiza o card com nome + link.

## Edge cases & riscos

- **`/uploads` público** com nome-hash — aceito no MVP (igual ao áudio).
- **Deploy efêmero** (ex.: Render sem disco persistente): anexos somem em
  redeploy — mesma limitação do áudio. Fora de escopo resolver.
- **GIF animado**: aceito (`image/gif`), renderiza como `<img>`.
- **Um anexo por mensagem**, sem legenda de texto junto.
- **`fakeRtdb.update()` de chave plana**: se os testes de `createMessage` com
  anexo usarem o fake, lembrar que ele só suporta chaves planas (limitação já
  documentada) — as gravações de `createMessage` são planas, então ok.

## Verificação

Backend `node --test` verde, frontend `vitest` verde, `npm run build` OK, delta
de lint 0, **sem dependência npm nova**.

## Fora de escopo

- Firebase Storage; anexos de tipo arbitrário; múltiplos anexos por mensagem;
  legenda de texto junto do anexo; busca no emoji picker; skin tones;
  compressão/resize de imagem no client; GC de arquivos órfãos em `/uploads`.
