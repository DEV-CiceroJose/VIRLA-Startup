# Cutover MongoDB → Firebase (Firestore)

Guia operacional para colocar o backend Firebase-only no ar. O **código** já foi
migrado (Prisma/MongoDB removidos; persistência no Firestore). Faltam apenas
passos de **configuração e dados**, listados abaixo na ordem de execução.

> Projeto Firebase: `virla-startap`. O chat continua no **Realtime Database**;
> o restante dos dados (usuários, solicitações, cobranças, pagamentos, escrow)
> vive no **Firestore**.

---

## 0. Pré-requisitos

- Acesso ao [Console do Firebase](https://console.firebase.google.com/) do projeto.
- `firebase-tools` instalado (`npm i -g firebase-tools`) e `firebase login`.
- A string de conexão atual do MongoDB (para migrar os dados uma última vez).

---

## 1. Credenciais do backend (`backend/.env`) — OBRIGATÓRIO

Sem isto o Firestore não conecta e o backend fica **sem banco**.

1. Firebase Console → **Configurações do Projeto** → **Contas de Serviço** →
   **Gerar nova chave privada** (baixa um JSON).
2. No `backend/.env`, preencha a partir do JSON (veja `backend/.env.example`):
   ```
   FIREBASE_PROJECT_ID="virla-startap"
   FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxx@virla-startap.iam.gserviceaccount.com"
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_DATABASE_URL="https://virla-startap-default-rtdb.firebaseio.com"
   ```
   > A `FIREBASE_PRIVATE_KEY` deve manter os `\n` **literais** (não quebre a linha de verdade).
3. `DATABASE_URL` (Mongo) **não é mais usada** pelo backend — só pelo script de
   migração de dados (passo 3). Pode remover depois do cutover.

**Frontend:** o `frontend/.env` já foi criado com as variáveis `VITE_FIREBASE_*`.

---

## 2. Passos manuais no Console do Firebase

### 2.1 Ativar o Firebase Authentication
Necessário para o chat em tempo real (o backend emite custom tokens).
1. Console → **Authentication** → **Começar** (Get Started).
2. Não precisa configurar provedor; só ativar já habilita os custom tokens.

### 2.2 Publicar as regras do Realtime Database (chat)
1. Console → **Realtime Database** → aba **Rules**.
2. Cole o conteúdo de `backend/firebase.rules.json` e **Publicar**.

> 💡 Sem 2.1/2.2 o chat ainda funciona em **modo de contingência HTTP** (polling
> a cada 4s). Com eles, passa a **tempo real instantâneo** automaticamente.

### 2.3 Regras e índices do Firestore
A partir da pasta `backend/` (onde estão `firestore.rules` e `firestore.indexes.json`):
```bash
firebase deploy --only firestore:rules,firestore:indexes
```
> As regras são **deny-all para clientes** — o frontend não acessa o Firestore
> diretamente, só o backend (via Admin SDK). Os repositórios usam consultas de
> campo único, então `firestore.indexes.json` está vazio por ora.

---

## 3. Migrar os dados (uma vez)

Migra usuários, solicitações, cobranças, pagamentos e escrow do Mongo para o
Firestore, **preservando os IDs** (mantém as referências cruzadas).

```bash
cd backend
npm i mongodb                     # dependência só do script
# garanta DATABASE_URL (Mongo) e FIREBASE_* no .env

node scripts/migrate-mongo-to-firestore.js --dry-run   # só conta, não escreve
node scripts/migrate-mongo-to-firestore.js             # migra de verdade
```
- O script é **idempotente** (usa `doc(<id antigo>).set(...)`): rodar 2x não duplica.
- Confira as contagens por coleção no Console (Firestore) vs Mongo.
- `npm rm mongodb` depois, se quiser.

> As **mensagens de chat** NÃO são migradas aqui — já vivem no Realtime Database
> desde a Sprint 0.

---

## 4. Smoke test pós-cutover

Com `backend/.env` configurado:
```bash
cd backend && npm run dev      # deve logar "firestore:initialized" e "server:started"
```
Valide manualmente (ou com o frontend apontando para este backend):
- **Login** (`POST /login`) e **buscar perfil** (`GET /users/:id`).
- **Criar e listar solicitação** (familiar/cuidador).
- **Health:** `GET /health` deve responder `database: ok`.
- **Fluxo de pagamento/escrow** (só se reativar a UI com `VITE_ENABLE_PAYMENT=true`):
  iniciar billing → confirmar → conferir escrow `HELD` → `release`/`dispute`.

> ⚠️ A camada Firestore (repositórios e transações de escrow) **não foi testada
> contra um Firestore real/emulador** durante a migração — só unit tests
> (`node --test`), imports e boot do servidor. Faça este smoke antes de produção.

---

## 5. Encerramento

- Após validar tudo, **desative o cluster MongoDB** e **rotacione a senha** que
  estava em `backend/.env` (ela foi exposta no arquivo local).
- Remova `DATABASE_URL` do `.env` de produção.

---

## Referência rápida — o que mudou no código

- Persistência: `backend/src/repositories/*` (Firestore) substituem `prisma.*`.
- Escrow: `escrowService.js` usa `db.runTransaction` (compare-and-set +
  idempotência por doc-id) — `backend/src/services/escrowService.js`.
- Plano detalhado: `docs/superpowers/plans/2026-06-28-migracao-mongodb-para-firestore.md`.
