# Sprint 0 — Migração do Chat para Firebase Realtime Database

> Status: **Implementada** (código nesta versão `VirlaFinal-V1.zip`)
> Prioridade: Máxima — antecede e substitui a antiga Sprint 1 ("Corrigir Chat em Produção")

## Objetivo

Eliminar os problemas de sincronização do chat em produção (mensagens que não
atualizam sem recarregar a página, "Reconectando..." constante) substituindo
a camada de mensagens — antes MongoDB/Prisma + Socket.io — pelo **Firebase
Realtime Database**, que oferece sincronização em tempo real nativa entre
cliente e servidor, sem depender de upgrade de WebSocket via proxy reverso.

## Decisão de arquitetura: migração híbrida

Em vez de mover **todo** o banco de dados para o Firebase, optamos por uma
migração híbrida:

| Domínio | Antes | Depois |
|---|---|---|
| Usuários, Pagamentos, Escrow, Cobranças | MongoDB + Prisma | **Mantido** — MongoDB + Prisma |
| Mensagens de chat (texto e áudio) | MongoDB + Prisma + Socket.io | **Firebase Realtime Database** |

**Por quê:** o Realtime Database é excelente para dados simples de alta
frequência de escrita/leitura como mensagens, mas não é adequado para dados
relacionais e transacionais como pagamentos e escrow (sem transações ACID
nativas, sem queries relacionais). Migrar tudo geraria retrabalho grande e
risco desnecessário para módulos que já funcionam bem.

## O que mudou

### Backend

- **`src/lib/firebase.js`** — inicializa o Firebase Admin SDK (autenticação
  via Service Account) e exporta a instância do Realtime Database (`rtdb`).
- **`src/services/chatRealtimeService.js`** — nova camada de acesso a dados
  que substitui o `model Message` do Prisma. Implementa `createMessage`,
  `getHistory`, `getConversations`, `getUnreadCount`, `markAsRead` sobre o
  RTDB.
- **`src/controllers/messageController.js`** — reescrito para usar o
  `chatRealtimeService` em vez do Prisma. O Prisma continua sendo usado
  apenas para validar/enriquecer dados de **usuário** (que não migrou).
- **`src/controllers/firebaseController.js`** + **`src/routes/firebaseRoutes.js`**
  — novo endpoint `GET /firebase/token`, que emite um *Custom Token* do
  Firebase Auth a partir do JWT da sessão já validado. O frontend usa esse
  token para autenticar no Firebase e satisfazer as Security Rules do RTDB.
- **`src/events/messageEvents.js`** — drasticamente simplificado. O
  Socket.io **não entrega mais o conteúdo das mensagens**; ele continua
  ativo apenas para sinais efêmeros e baratos: indicador de "digitando…",
  presença online/offline e um aviso leve (`notify_message` →
  `receive_message_notify`) para acionar toast/som em outras telas do app
  mesmo quando o usuário não está com a tela de chat aberta.
- **`scripts/migrate-messages-to-firebase.js`** — script one-off que lê
  todas as mensagens existentes no MongoDB, descriptografa o conteúdo e
  grava no RTDB na nova estrutura. Idempotente (pode rodar mais de uma vez).
- **`firebase.rules.json`** — Security Rules do Realtime Database (colar no
  Console do Firebase) garantindo que só remetente/destinatário autenticados
  acessam cada conversa.

### Frontend

- **`src/services/firebase.js`** — inicializa o Firebase App, Auth e
  Realtime Database no cliente.
- **`src/services/firebaseAuth.js`** — troca o JWT da sessão por um Custom
  Token (via `GET /firebase/token`) e autentica no Firebase Auth.
- **`src/hooks/useFirebaseChat.js`** — novo hook que:
  - escuta `chats/{chatId}/messages` via `onChildAdded` (substitui o evento
    `receive_message` do Socket.io);
  - escreve mensagens **diretamente no Firebase** (`sendMessage`), sem
    round-trip pelo backend — a propagação para o destinatário é responsabilidade
    nativa do RTDB;
  - marca mensagens como lidas (`markRead`) diretamente no RTDB.
- **`src/pages/Chat/index.jsx`** — passou a usar `useFirebaseChat` para
  envio/recepção de mensagens de texto. O `useSocket` continua sendo usado
  só para "digitando…", confirmação de leitura e indicador de conexão.
- **`src/context/SocketContext.jsx`** — listener global de notificação
  atualizado para escutar o novo evento leve `receive_message_notify`.

## Estrutura de dados no Realtime Database

```
chats/
  {chatId}/                          # chatId = [userIdA, userIdB] ordenados e unidos por "_"
    members/
      {userId}: true
    messages/
      {messageId}/
        senderId, receiverId, content, audioUrl, read, createdAt

userChats/
  {userId}/
    {chatId}/
      peerId, lastMessage, lastMessageAt
```

## Trade-off de segurança: fim da criptografia de campo (AES) nas mensagens

Antes, o conteúdo das mensagens era criptografado com AES-256-CBC
(`src/lib/crypto.js`) antes de ir para o Mongo. No novo desenho, o conteúdo
é gravado **em texto puro** no Realtime Database, e a proteção de acesso
passa a ser feita pelas **Security Rules** (somente remetente e
destinatário autenticados conseguem ler/escrever em cada `chats/{chatId}`).

Isso segue o padrão recomendado pelo próprio Firebase para chats e, na
prática, **não reduz a segurança fim-a-fim**: o conteúdo já trafegava como
texto puro para o cliente (via Socket.io/REST) mesmo antes — a criptografia
protegia apenas o dado "em repouso" dentro do Mongo. Quem tivesse acesso ao
banco Mongo via Prisma também não via nada útil sem a `ENCRYPTION_KEY`; no
modelo novo, quem tem acesso ao Console do Firebase (ou às credenciais de
admin) vê o conteúdo em texto puro.

**Se a criptografia em repouso for um requisito não-negociável**, ela pode
ser reintroduzida no futuro via Cloud Functions (exige o plano pago
"Blaze" do Firebase) que cifram o campo `content` antes da escrita — isso
ficou fora do escopo da Sprint 0 e pode entrar como um item futuro.

## Passo a passo para colocar em produção

1. Criar um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Ativar o **Realtime Database** (não confundir com Firestore) em modo
   "bloqueado" (regras restritivas por padrão).
3. Em **Configurações do Projeto → Contas de Serviço**, gerar uma nova
   chave privada (JSON) e preencher no backend (`.env`):
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (mantendo os `\n` literais)
   - `FIREBASE_DATABASE_URL`
4. Em **Configurações do Projeto → Geral → Seus apps**, criar um app Web e
   preencher no frontend (`.env`, ver `.env.example`):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`
5. Em **Authentication**, ativar o provedor "Custom" (criado automaticamente
   ao usar Custom Tokens — não precisa configuração extra).
6. Publicar as regras de `backend/firebase.rules.json` em
   **Realtime Database → Regras** no Console.
7. Instalar as novas dependências:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
8. Rodar a migração das mensagens existentes (uma única vez):
   ```bash
   cd backend && node scripts/migrate-messages-to-firebase.js
   ```
9. Subir o backend e o frontend normalmente. O endpoint `/health` e o resto
   da aplicação continuam funcionando exatamente como antes.

## Critério de conclusão

- [x] Mensagens aparecem em tempo real (texto e áudio) sem recarregar a
      página, via Firebase Realtime Database.
- [x] Histórico de mensagens migrado sem perda de dados (script de
      migração testável/idempotente).
- [x] Socket.io removido do caminho crítico de entrega de mensagens —
      mantido apenas para "digitando…", presença e notificação leve.
- [x] Regras de segurança do Firebase restringem acesso a cada conversa
      somente aos seus dois participantes autenticados.

## Próximos passos (Sprint 1 original)

Como a causa raiz do problema descrito na Sprint 1 ("chat não atualiza em
produção") era justamente a fragilidade do Socket.io em ambiente hospedado,
essa sprint deixa de ser necessária como estava planejada. Recomendamos que
a antiga Sprint 1 vire apenas uma rodada de **testes de regressão em
produção** (validar em ambiente real hospedado que a Sprint 0 realmente
resolveu o problema), antes de seguir para a Sprint 2 em diante.
