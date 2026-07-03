# Design — Migração de autenticação para o Firebase Auth

**Data:** 2026-07-02
**Contexto:** tasks FEAT-01 (esqueci senha), SEC-01 (verificação de e-mail) e login por Google, do roadmap de melhorias do Fabio.
**Status:** aprovado no brainstorming; pendente de plano de implementação.

## Problema

O login do app **hoje não usa Firebase Auth**. A identidade é do backend próprio:
`POST /auth/login` compara senha com **bcrypt**, senhas ficam na coleção `users`
do Firestore e a sessão é um **JWT próprio** (`meuToken` no localStorage). O
Firebase Auth só é usado indiretamente pelo chat, via *custom token*
(`GET /firebase/token` + `signInWithCustomToken`) para satisfazer as Security
Rules do Realtime Database.

Consequência: o reset de senha e o login Google habilitados no Firebase Console
**não funcionam** com os usuários atuais, porque o Firebase Auth não conhece
essas contas. Não é "só ligar os botões" — é uma mudança de fonte de identidade.

## Decisões (brainstorming)

1. **Firebase Auth vira a fonte da identidade.** Alinha com a decisão Firebase-only.
2. **Pode zerar usuários** (pré-lançamento) → sem migração de senha. A coleção
   `users` passa a ser chaveada pelo **uid do Firebase**.
3. **Google 1º acesso → tela "Completar cadastro"** (role + CPF + obrigatórios).
4. **CPF continua obrigatório.**
5. **Verificação de e-mail é obrigatória e bloqueante**, checada no login
   (frontend) **e** no backend (`email_verified` no ID token → 403). Google já
   vem verificado.
6. **Autorização backend (abordagem A):** `checkToken` faz `verifyIdToken` a cada
   request; `role` vem de **custom claim**. O fluxo de custom token do chat é
   **removido** (o usuário já está logado no Firebase Auth nativamente).

## Arquitetura

- **Identidade:** Firebase Auth (client SDK).
- **Perfil:** coleção `users` do Firestore, **doc id = uid do Firebase**, sem
  campo `password`. `email` denormalizado (cópia do Firebase, gravada na criação).
- **Sessão:** frontend usa `auth.currentUser.getIdToken()` como `Bearer` em cada
  request (SDK renova sozinho, ~1h). Fim do `meuToken` no localStorage.
- **Autorização:** `checkToken` → `admin.auth().verifyIdToken(idToken)`;
  `req.userId = uid`, `req.userRole = claim.role`, `req.email`. Rejeita
  `email_verified=false` com 403, exceto rotas isentas.

### Fluxos

1. **Cadastro e-mail/senha:** `createUserWithEmailAndPassword` →
   `sendEmailVerification` → `POST /users` cria perfil (role/CPF/obrigatórios) por
   uid → `setCustomUserClaims(uid,{role})`. Não entra ainda: cai no modal de
   "confirme seu e-mail".
2. **Login e-mail/senha:** `signInWithEmailAndPassword` → se
   `emailVerified=false` → **modal bloqueante** (reenviar / já confirmei / sair) e
   não entra. Se verificado mas sem perfil → **Completar cadastro**. Se ok → entra.
3. **Google:** `signInWithPopup(GoogleAuthProvider)` (já verificado) → sem perfil
   (`GET /users/me` = 404) → **Completar cadastro** → `POST /users` → claim de
   role. Com perfil → entra.
4. **Esqueci a senha:** `sendPasswordResetEmail(email)` (100% client-side).
5. **Logout:** `signOut()` no cliente (+ `revokeRefreshTokens(uid)` opcional).
6. **Chat:** remove `GET /firebase/token` + `signInWithCustomToken`; `auth.uid`
   (= id do perfil) satisfaz as regras do RTDB diretamente.

## Componentes

### Backend

- **`middlewares/checkToken.js`**: `verifyIdToken` no lugar de `jwt.verify`; seta
  `req.userId/userRole/email`; enforce `email_verified` (403). Duas variantes:
  `checkToken` (exige e-mail verificado) e `checkTokenAllowUnverified` (não exige;
  só `POST /users` e `GET /users/me`).
- **`lib/firebase.js`**: Admin SDK passa a ser **obrigatório** (auth depende dele).
  Ajustar comentários/degradação: sem Firebase configurado, a API de auth não sobe.
- **`controllers/authController.js`**: remove `LoginUser` e `POST /auth/login`;
  adiciona `GET /users/me` (perfil do `req.userId` ou 404).
- **`controllers/userController.js`**: `createUsers` sem hash de senha, pega
  `uid`+`email` do token, cria doc com **id = uid**, seta claim `role`, valida
  role/CPF (+ unicidade de CPF); `deleteUsers` também deleta o usuário no Firebase
  Auth (`admin.auth().deleteUser(uid)`); `updateUsers` sem edição de e-mail.
- **`repositories/userRepository.js`**: `createUserWithId(uid, data)` no lugar do
  id automático; novo `cpfExists`.
- **`schemas/`**: remove `loginBodySchema`; `createUserBodySchema` sem `password`
  (e `email` vem do token).
- **Rotas/remoções**: `authRoutes` (remove login, add `/users/me`); `userRoutes`
  (`POST /users` usa `checkTokenAllowUnverified`); **remove `firebaseRoutes.js` +
  `firebaseController.js`**; `chatRealtimeService.js` inalterado; `bcrypt` sai do
  `package.json`.

### Frontend

- **`services/firebase.js`**: adiciona `GoogleAuthProvider`; config obrigatória.
- **`services/auth.js`** (novo, substitui `firebaseAuth.js`): `registerWithEmail`,
  `loginWithEmail`, `loginWithGoogle`, `resetPassword`, `logout`,
  `resendVerification`, `reloadUser`, `getIdToken`, `onAuthChange`, `mapAuthError`.
- **`services/api.js`**: interceptor **async** usando `getIdToken()`; remove `meuToken`.
- **`context/AuthContext` + `useAuth()`**: `{ firebaseUser, profile, emailVerified,
  needsProfile, loading }` via `onAuthStateChanged` + `GET /users/me`. Integra com
  `AppShell.jsx` e `hooks/useAuthRedirect.js`.
- **`pages/Login`**: `loginWithEmail`; botão "Entrar com Google"; link "Esqueci
  minha senha"; dispara modal de verificação se `emailVerified=false`.
- **`pages/Cadastro`**: `registerWithEmail` → `POST /users`; "Cadastrar com
  Google"; confirmação de senha (FE-12).
- **`pages/CompletarCadastro`** (novo): quando há usuário Firebase sem perfil;
  coleta role + CPF + obrigatórios → `POST /users`.
- **Reset de senha**: modal/tela simples (e-mail → `resetPassword`).
- **`EmailVerificationModal`** (novo, estilo `ui/ConfirmDialog`): bloqueante;
  botões Reenviar / Já confirmei (`reloadUser` + recheca) / Sair (`logout`).
- **Varredura `meuToken`**: remover todas as leituras/escritas no app (Login,
  AppShell, Chat, logout); Chat deixa de chamar `connectFirebaseAuth`.

## Modelo de dados & security rules

- **`users`**: doc id = uid; sem `password`; `email` denormalizado; CPF único
  (best-effort, nota de janela de corrida — MVP).
- **Custom claims**: `role` via `setCustomUserClaims`; cliente faz
  `getIdToken(true)` após criar o perfil pra o claim entrar no token.
- **RTDB rules**: baseadas em `auth.uid`; como o id do perfil agora é o uid do
  Firebase, continuam válidas **sem mudança** — a confirmar no arquivo/Console.
- **Zeragem (pré-lançamento)**: apagar docs `users` antigos e dados de chat com
  ids antigos. Sem migração de senha.
- **Consistência**: auth sem perfil → próximo login cai em Completar cadastro
  (auto-corrige). Sem novos segredos de env.

## Tratamento de erros

- **Frontend** (`mapAuthError`): `email-already-in-use`, `invalid-email`,
  `weak-password`, `too-many-requests`, `network-request-failed`; credenciais
  inválidas → mensagem genérica (anti-enumeração); `popup-closed-by-user`/
  `popup-blocked` → sem toast de erro.
- **Backend**: token inválido/expirado → 401; `email_verified=false` → 403;
  rota que exige `role` sem claim (perfil não criado) → resposta clara
  direcionando a completar cadastro (não 500).
- `sendPasswordResetEmail` não revela existência do e-mail (mantém não-enumeração).

## Testes

- **Backend (`node:test`)**: `checkToken` (verificado→next; não verificado→403;
  inválido→401; variante `allowUnverified`); `createUsers` (doc por uid, seta
  claim, CPF duplicado→409, role obrigatório); `cpfExists`; schemas sem `password`.
  Mockar `admin.auth()`.
- **Frontend (`vitest` + testing-library)**: `services/auth.js` com SDK mockado
  (register dispara `sendEmailVerification`; `mapAuthError`); Login (não
  verificado→modal; botão Google; esqueci senha); CompletarCadastro; interceptor
  do axios anexa `getIdToken`.
- **Reescrever** `Login.test.jsx` (testava `POST /auth/login`) e `api.test.js`
  (interceptor `meuToken`).
- **Verificação manual (preview)**: cadastro→verificação→login→Google→reset.

## Fora de escopo (ficam no roadmap)

- SEC-03 completo (sessão) — a migração já entrega logout com invalidação real
  (`revokeRefreshTokens`) e expiração curta do ID token como bônus parcial.
- Demais tasks do roadmap (validações de formulário, chat, produto).
