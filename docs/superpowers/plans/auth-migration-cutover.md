# Cutover — Migração para Firebase Auth (operacional)

> Passos operacionais para colocar a migração de autenticação em produção.
> A migração já está **completa no código** (branch `tasks-dev`): Firebase Auth é a
> fonte de identidade, `users` é chaveado pelo uid do Firebase, login/cadastro/
> Google/reset/verificação passam pelo Firebase, o custom token do chat foi
> removido e o socket do backend passou a verificar o ID token do Firebase.
>
> ⚠️ A seção **Zeragem** é destrutiva e vale **apenas para pré-lançamento**.

## 1. Pré-requisitos no Firebase Console

- **Authentication → Sign-in method:** provedores **E-mail/senha** e **Google**
  habilitados (já feito).
- **Authentication → Settings → Authorized domains:** incluir o domínio do app
  (produção e, se usar, o de preview/Vercel/Render). `localhost` já vem liberado
  para desenvolvimento. Sem isso o `signInWithPopup(Google)` falha.
- **Templates de e-mail** (Authentication → Templates): revisar os textos de
  **Verificação de e-mail** e **Redefinição de senha** (remetente, idioma, link).
  O Firebase envia esses e-mails — o app não tem infra de SMTP própria.
- **Realtime Database → Rules:** publicar o conteúdo de `backend/firebase.rules.json`
  (ver seção 4).

## 2. Variáveis de ambiente

**Frontend** (`frontend/.env`, prefixo `VITE_`), consumidas em
`frontend/src/services/firebase.js`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_URL=<url do backend>
```

**Backend** (`backend/.env`), consumidas em `backend/src/lib/firebase.js` (Admin SDK):

```
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="...\n..."   # \n literais são convertidos em quebras reais
FIREBASE_DATABASE_URL=...
```

> **Importante:** após a migração o Firebase Admin passou a ser **obrigatório** no
> backend — ele agora verifica o ID token de **toda** requisição autenticada e do
> socket. Sem `FIREBASE_*` configurado, a API de auth não funciona (não é mais só
> o chat que degrada). Ver `backend/.env.example` para o modelo completo.
>
> A variável `SECRET` (JWT antigo) **não é mais usada** para autenticação e pode
> ser removida do `.env` — confirme antes que nada legado dependa dela.

## 3. Zeragem de dados (DESTRUTIVO — só pré-lançamento)

Como os perfis passaram a ser chaveados pelo **uid do Firebase**, os documentos
antigos de `users` (com ids automáticos) ficam **órfãos**. Como combinado (base de
testes descartável), zeramos tudo:

1. **Firestore → coleção `users`:** apagar todos os documentos.
   - Console: Firestore → `users` → excluir a coleção.
   - Ou via Admin SDK (executar uma vez, num script Node do backend):
     ```js
     import { firebaseAdmin } from './src/lib/firebase.js'
     const db = firebaseAdmin.firestore()
     const snap = await db.collection('users').get()
     const batch = db.batch()
     snap.docs.forEach((d) => batch.delete(d.ref))
     await batch.commit()
     console.log(`apagados ${snap.size} perfis`)
     ```
2. **Realtime Database:** apagar os nós `chats/` e `userChats/` (ids antigos).
   - Console: Realtime Database → selecionar `chats` → excluir; idem `userChats`.
3. **Firebase Authentication → Users:** remover quaisquer usuários de teste
   pré-existentes (Console → Authentication → Users → excluir), para não conflitar
   com CPF/e-mail nos novos cadastros.

Depois da zeragem, o primeiro cadastro recria tudo no novo formato.

## 4. Regras do Realtime Database — revisão

Arquivo: `backend/firebase.rules.json`. Todas as regras são baseadas em `auth.uid`:

- `chats/$chatId` leitura/escrita exigem `data.child('members/' + auth.uid).exists()`;
- `chats/$chatId/messages/$messageId` escrita exige `newData.child('senderId').val() == auth.uid`
  (ou o destinatário marcando leitura);
- `userChats/$userId` leitura exige `auth.uid == $userId`.

**Veredito: nenhuma mudança de regra é necessária.** Antes da migração, `auth.uid`
vinha do *custom token* emitido pelo backend com `uid = id do usuário no backend`.
Agora `auth.uid` é o **uid nativo do Firebase Auth**, que passou a ser **o próprio
id do perfil** — o mesmo id usado em `members/*` e em `senderId`. O `chatId` é
derivado desses ids em `frontend/src/hooks/useFirebaseChat.js`
(`chatIdFor(a,b) = [a,b].sort().join('_')`), então a correspondência
`auth.uid` ↔ `members/$uid` continua válida. As escritas administrativas do backend
(`chatRealtimeService`, Admin SDK) ignoram as regras, sem impacto.

> Ação: apenas **publicar** essas regras no projeto de produção (Console →
> Realtime Database → Rules → colar o JSON → Publicar), caso ainda não estejam lá.

## 5. Verificação E2E (execução MANUAL — exige projeto Firebase real)

Não é possível automatizar aqui (popup do Google, e-mails reais). Rodar
manualmente com backend (`cd backend && npm start`) e frontend
(`cd frontend && npm run dev`), após a zeragem:

1. **Cadastro e-mail/senha:** criar conta → recebe e-mail de verificação. Tentar
   logar sem confirmar → **modal bloqueante** aparece e não entra; uma chamada a
   rota protegida da API responde **403**.
2. **Confirmar e-mail** (link do e-mail) → no modal, **"Já confirmei"** libera → entra.
3. **Google 1º acesso:** popup do Google (já verificado) → cai em **Completar
   cadastro** → escolhe role + CPF → entra em `/home`.
4. **Google 2º acesso:** entra direto (perfil já existe).
5. **Esqueci a senha:** informar e-mail no login → **"Esqueci minha senha"** →
   recebe e-mail de reset → redefine → loga com a nova senha.
6. **Chat:** abrir uma conversa e enviar mensagem — entrega em tempo real pelo
   RTDB, sem erro de permissão (`PERMISSION_DENIED`).
7. **Logout:** sair → rota protegida redireciona para `/login`.

Registrar evidências (prints/console) das etapas 1–3 e 6.

## 6. Rollback

Como é pré-lançamento e a base foi zerada, o rollback é reverter a branch
`tasks-dev` (não fazer merge) e restaurar o `.env` com `SECRET`. Não há dados de
produção a preservar.
