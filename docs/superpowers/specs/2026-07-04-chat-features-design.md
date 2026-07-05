# Chat — Apagar mensagem (CHAT-01) + Sair/arquivar conversa — Design

> Escopo decomposto do CHAT-03 do `docs/ROADMAP-melhorias-fabio.md`. Durante o
> brainstorm da Fase 2 (bloco A) descobriu-se que o CHAT-03 original ("reusar
> ConfirmDialog em excluir mensagem / cancelar solicitação / sair de conversa")
> tinha premissa incorreta: "cancelar solicitação" já usa `ConfirmDialog`, e
> "excluir mensagem" e "sair de conversa" **não existiam no código**. Este spec
> cobre as duas features novas: CHAT-01 (apagar mensagem própria em janela de
> tempo) — que era da Fase 4 do roadmap e foi puxado pra cá — e "sair/arquivar
> conversa".

## Contexto: arquitetura atual do chat

O chat **não** roda no Firestore — roda no **Firebase Realtime Database (RTDB)**.
O Firestore guarda só perfis de usuário (`userRepository`).

Estrutura no RTDB (ver `backend/src/services/chatRealtimeService.js`):

```
chats/{chatId}/members/{userId}      -> true
chats/{chatId}/messages/{messageId}  -> { senderId, receiverId, content, audioUrl, read, createdAt }
userChats/{userId}/{chatId}          -> { peerId, lastMessage, lastMessageAt }   (índice p/ lista de conversas)
```

`chatId` é determinístico: os dois userIds ordenados unidos por `_` (`chatIdFor`).

Caminhos de dados relevantes:
- **Envio:** o cliente escreve direto no RTDB (`useFirebaseChat.sendMessage`),
  com **fallback HTTP** (`POST /messages` → `chatRealtimeService.createMessage`,
  admin SDK). O `createMessage` também chama `touchUserChats` (atualiza o índice
  de conversas dos dois lados).
- **Leitura em tempo real:** o hook `useFirebaseChat` assina **só `onChildAdded`**
  hoje.
- **Read receipts:** cliente-direto (`markRead`) + HTTP (`markAsRead`, admin SDK)
  + sinal efêmero via socket.io.
- **Lista de conversas:** `GET /conversations` → `getConversations(meId)` lê
  `userChats/{meId}` e ordena por `lastMessageAt`. Renderizada em
  `pages/Home/index.jsx` (aba "mensagens").
- **Regras de segurança RTDB** (`backend/firebase.rules.json`): hoje **proíbem
  delete** para todo mundo e só deixam o destinatário atualizar uma mensagem se
  o `content` não mudar (caminho de read-receipt).

Fato importante: a conversa é **sempre acessível** pelo perfil do peer
(feed/perfil → "Conversar" → `/chat/:userId`), porque `getMessageHistory` não
depende de `userChats`. Logo "arquivar" = tirar da lista de recentes, não perder
acesso.

## Decisões (tomadas com o usuário)

1. **Apagar = tombstone** ("Esta mensagem foi apagada"), não remoção total. O nó
   permanece com `deleted:true`, `content:''`, `audioUrl:null`; ambos veem o
   placeholder. Propaga em tempo real e não deixa "buraco" no histórico.
2. **Janela de apagar: 10 minutos** (`600_000 ms`) a partir de `createdAt`.
3. **Arquivar reaparece:** arquivar só esconde da lista de recentes; qualquer
   mensagem nova na conversa a desarquiva (estilo WhatsApp). Nunca perde
   mensagem.
4. **Mecanismo: endpoint no backend (admin SDK).** A janela é validada com o
   **relógio do servidor** (confiável); o tombstone/arquivo é escrito pelo admin
   SDK. Regras do RTDB ficam **inalteradas** (admin bypassa regras). Espelha o
   padrão de `markAsRead`.

## Backend

### `backend/src/services/chatRealtimeService.js`

- **`deleteMessage(meId, peerId, messageId)`**
  - Lê `chats/{chatId}/messages/{messageId}`.
  - Lança erro tipado se: não existe (`not_found`); `senderId !== meId`
    (`forbidden`); `Date.now() - createdAt > 600_000` (`window_expired`).
  - Senão, atualiza o nó pra tombstone: `{ deleted: true, content: '',
    audioUrl: null }` (preserva `senderId`, `receiverId`, `createdAt`, `read`).
  - Se essa mensagem for a **mais recente** do chat, atualiza
    `userChats/{meId}/{chatId}/lastMessage` e
    `userChats/{peerId}/{chatId}/lastMessage` para `'🚫 Mensagem apagada'`
    (evita preview velho na lista de recentes).
  - Os erros tipados podem ser um objeto `{ code }` (ex.:
    `Object.assign(new Error(...), { code: 'window_expired' })`) para o
    controller mapear pro status HTTP.
- **`setArchived(meId, peerId, archived)`**
  - Atualiza **só** `userChats/{meId}/{chatId}/archived = archived` (o índice do
    peer não é tocado — ele continua vendo a conversa).
- **`getConversations(meId)`** — passa a filtrar entradas com `archived === true`.
- **`touchUserChats(...)`** — adiciona `archived: false` no payload de update dos
  **dois** lados. Como roda em toda mensagem nova (via `createMessage`), qualquer
  atividade nova desarquiva a conversa para ambos → reaparece na lista.

### `backend/src/controllers/messageController.js`

- **`deleteMessage`** (handler): valida `peerId`/`messageId` nos params; chama
  `chatRealtimeService.deleteMessage`; mapeia erros: `not_found` → `404`,
  `forbidden` → `403`, `window_expired` → `409` (com msg "O prazo para apagar
  esta mensagem já passou."); `200` + `{ message }` no sucesso.
- **`archiveConversation`** (handler): valida `peerId` e `archived` (boolean) no
  body; chama `setArchived`; `200` no sucesso. Segue a forma de `markAsRead`.

### `backend/src/routes/messageRoutes.js`

- `DELETE /messages/:peerId/:messageId` → `deleteMessage` (protegida por `checkToken`).
- `PATCH /conversations/:peerId/archive` → `archiveConversation` (body
  `{ archived: boolean }`, protegida por `checkToken`).

### Regras de segurança RTDB

**Inalteradas.** Delete e archive passam pelo admin SDK (bypassa regras). Nenhum
passo de cutover novo além da publicação de regras já planejada.

## Frontend

### `frontend/src/hooks/useFirebaseChat.js`

- Novo listener **`onChildChanged`** (junto do `onChildAdded`), expondo um
  callback `onMessageChanged`. Propaga tombstones **e** read-receipts em tempo
  real: quando um nó de mensagem muda, a página troca a mensagem no estado por
  `id`.
- Novo helper puro exportado **`canDeleteMessage(message, meId, nowMs)`**:
  `message.senderId === meId && !message.deleted && !message._optimistic &&
  nowMs - message.createdAt <= 600_000`. Unit-testável, usado pela UI pra decidir
  se mostra o botão de lixeira. (Fica neste arquivo por co-localização — já é
  onde vive `chatIdFor` — mas é uma função pura sem dependência do hook.)

O hook **não** ganha a chamada HTTP de delete: as ações do hook são
RTDB-diretas (`sendMessage`, `markRead`), então a chamada `api.delete` vive na
página de Chat (que já chama `api.post('/messages')` direto no fallback de
envio). O tombstone ao vivo chega via `onChildChanged`; a UI pode aplicar um
tombstone otimista pra resposta imediata e deixar o eco confirmar.

### `frontend/src/pages/Chat/index.jsx`

- **Apagar:** clicar/tocar na **própria** mensagem não-apagada dentro da janela
  (via `canDeleteMessage`) revela um botão de lixeira pequeno na bolha. Clicar
  abre `ConfirmDialog` ("Apagar mensagem? Ela aparecerá como apagada para os
  dois."). Confirmar → `api.delete('/messages/{peerId}/{id}')`. Mensagens fora da
  janela não mostram lixeira. Se o backend responder `409`, mostra toast ("O
  prazo para apagar já passou.").
- **Render do tombstone:** mensagem com `deleted:true` vira uma bolha
  itálico/cinza "🚫 Esta mensagem foi apagada", sem horário/checkmarks e sem
  player de áudio.
- **`onMessageChanged`** → troca-por-id em `setMessages` (cobre tombstone +
  atualização de leitura, idempotente por id).
- **Sair da conversa:** um botão de ação único no header (ícone `ExitToApp`,
  `title="Sair da conversa"`), ao lado dos botões de cobrança/pagar/histórico
  já existentes — sem menu dropdown (mais simples, YAGNI). Abre `ConfirmDialog`
  ("Sair desta conversa? Ela sai da sua lista de conversas; a outra pessoa
  continua vendo, e você não perde o histórico."). Confirmar →
  `PATCH /conversations/{peerId}/archive {archived:true}` → navega pra
  `/home?tab=mensagens`.

### `frontend/src/pages/Home/index.jsx`

Sem mudança — `getConversations` já filtra arquivadas no servidor, então a
conversa arquivada some da lista no próximo load.

Ambas as ações reusam `ConfirmDialog` (a intenção original do CHAT-03).

## Testes

### Backend (`node --test`) — `backend/tests/chatRealtimeService.test.js` (novo)

Núcleo testável, com o `rtdb` admin mockado/injetado (stub das refs). Cobre:
- `deleteMessage`: happy path (nó vira tombstone); `forbidden` (autor ≠ caller);
  `window_expired` (`createdAt` > 10 min); `not_found` (mensagem ausente);
  última-mensagem → atualiza os dois previews de `userChats` pro marcador de
  tombstone.
- `setArchived` + `getConversations` filtrando `archived:true` +
  `touchUserChats` limpando `archived` (desarquivar).

### Frontend (`vitest`)

A `pages/Chat` não tem teste hoje. Testar os pedaços de lógica novos (não a
página inteira):
- `canDeleteMessage(message, meId, nowMs)` — dentro/fora da janela, mensagem de
  outro, já apagada, otimista.
- Merge troca-por-id do `onChildChanged`.
- Fluxo de `ConfirmDialog` do "Sair da conversa" (mock de `api.patch`).
- Render do tombstone (bolha "Esta mensagem foi apagada", sem checkmarks).

## Edge cases & riscos

- **Áudio apagado:** tombstone limpa `audioUrl` também; o arquivo no disco
  (`/uploads/...`) fica órfão — coleta de lixo está **fora de escopo** (anotado,
  não bloqueia).
- **Janela pelo relógio do servidor** no delete (autoritativo); a visibilidade do
  botão de lixeira usa o relógio do cliente só como dica de UI — se o relógio do
  cliente estiver adiantado e mostrar o botão tarde, o servidor ainda responde
  `409` e a UI mostra toast. Sem risco de dado.
- **Mensagens otimistas** (`_optimistic`, id temporário) não podem ser apagadas
  no servidor (sem id real ainda) — a lixeira só aparece em mensagens
  confirmadas.
- **Interação com read-receipt:** adicionar `onChildChanged` faz os read-receipts
  também fluírem pelo RTDB; é aditivo e consistente com o caminho via socket
  existente (sem conflito — ambos só setam `read:true`, merge idempotente por id).

## Verificação

Mesmo padrão das fases anteriores: backend `node --test` verde, frontend
`vitest` verde, `npm run build` OK, delta de lint 0.

## Fora de escopo

- Coleta de lixo de arquivos de áudio órfãos após tombstone.
- Editar mensagem (só apagar).
- "Apagar para mim" separado de "apagar para todos" — aqui o apagar é sempre
  para os dois (tombstone compartilhado).
- Uma pasta/aba de "Arquivadas" na UI — arquivar só remove da lista de recentes;
  a conversa volta por mensagem nova ou pelo perfil do peer.
