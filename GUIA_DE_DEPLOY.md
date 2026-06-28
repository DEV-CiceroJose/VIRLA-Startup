# 🚀 GUIA DE DEPLOY — Virla

Passo a passo para rodar localmente e publicar na **Render** (backend + frontend) com **MongoDB Atlas** e **AbacatePay**.

---

## 1. Pré-requisitos

- **Node.js 18+** (testado em Node 24)
- Conta no **MongoDB Atlas** (string de conexão `mongodb+srv://...`)
- Conta no **AbacatePay** (token de API e secret de webhook)
- Conta na **Render** (ou outro PaaS)

---

## 2. Variáveis de ambiente (backend)

Copie o template e preencha com valores reais:

```bash
cp backend/.env.example backend/.env
```

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `DATABASE_URL` | ✅ | Conexão MongoDB Atlas |
| `SECRET` | ✅ | Segredo do JWT (longo e aleatório) |
| `JWT_EXPIRES_IN` | — | Validade do token (padrão `7d`) |
| `ENCRYPTION_KEY` | ✅ | **Exatos 32 caracteres** (AES-256) |
| `ABACATEPAY_TOKEN` | ✅ | Token da API AbacatePay |
| `ABACATEPAY_WEBHOOK_SECRET` | ✅ (prod) | Valida assinatura do webhook |
| `PORT` | — | Porta HTTP (padrão `3002`) |
| `NODE_ENV` | ✅ (prod) | `production` |
| `FRONTEND_URL` | ✅ | URL do frontend (para CORS e callbacks) |
| `LOG_LEVEL` | — | `info` (prod) / `debug` (diag) |
| `LOG_MAX_SIZE`, `LOG_MAX_FILES` | — | Rotação de logs |
| `MAX_AUDIO_BYTES` | — | Limite de upload de áudio |
| `METRICS_TOKEN` | ✅ (prod) | Protege `/observability/dashboard` |

> ⚠️ **Segurança:** o `.env` está no `.gitignore` e **nunca** deve ser commitado. Se algum segredo for exposto, **rotacione-o** (gere novo SECRET/ENCRYPTION_KEY, regenere token do AbacatePay e a senha do banco).
> Alterar `ENCRYPTION_KEY` **invalida a descriptografia das mensagens já gravadas** — só troque em ambiente novo ou com plano de migração.

---

## 3. Rodando localmente

### Backend
```bash
cd backend
npm install
npx prisma generate     # gera o Prisma Client
npm run dev             # nodemon (ou: npm start)
```
O servidor sobe em `http://localhost:3002`. Valide:
```bash
curl http://localhost:3002/health
```

### Frontend
```bash
cd frontend/virla-experimental
npm install
# crie um .env com a URL da API:
echo 'VITE_API_URL=http://localhost:3002' > .env
npm run dev             # Vite em http://localhost:5173
```

### Rodar os testes do backend
```bash
cd backend
npm test                # 32 testes (node:test)
npm run test:coverage   # com cobertura
```

---

## 4. Deploy na Render

### 4.1 Backend (Web Service)

| Campo | Valor |
|-------|-------|
| **Root Directory** | `backend` |
| **Build Command** | `npm install && npx prisma generate` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/health` |

- Cadastre **todas** as variáveis da seção 2 em *Environment*.
- Defina `NODE_ENV=production` e `FRONTEND_URL` com a URL pública do frontend.

### 4.2 Frontend (Static Site)

| Campo | Valor |
|-------|-------|
| **Root Directory** | `frontend/virla-experimental` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

- Variável: `VITE_API_URL=https://SEU-BACKEND.onrender.com`

### 4.3 Webhook do AbacatePay
Aponte o webhook para:
```
https://SEU-BACKEND.onrender.com/webhooks/abacatepay
```
Configure o `ABACATEPAY_WEBHOOK_SECRET` igual ao painel do AbacatePay — em produção, requisições sem assinatura válida são **rejeitadas (401)**.

---

## 5. Notas específicas da Render (já tratadas no código)

O `server.js` já contém ajustes para o ambiente da Render (ver comentários "CORREÇÃO"):
- **Socket.io** inicia em `polling` e faz upgrade para `websocket` (proxy da Render).
- **Ping** ajustado (`pingInterval: 10s`, `pingTimeout: 20s`) para não cair antes do timeout TCP do proxy.
- **Graceful shutdown** drena conexões antes de encerrar (evita 502).
- **`trust proxy`** habilitado para IP real (rate limit / logs).
- `/health` agora reflete o estado real do banco — a Render reinicia só quando há degradação verdadeira.

---

## 7. Sprint 6 — Build com/sem fluxo de pagamento

Para gerar uma versão de demonstração/testes sem nenhum botão de cobrança/pagamento visível:

**Frontend** (`frontend/.env`):
```env
VITE_ENABLE_PAYMENT=false
```
Esconde: botão "Gerar Cobrança", botão "Pagar", banner de cobrança pendente no chat,
o modal de gerar cobrança e bloqueia o acesso direto a `/pagamento` e `/pagamento/sucesso`.

**Backend** (`backend/.env`) — opcional, defesa em profundidade:
```env
ENABLE_PAYMENT=false
```
Bloqueia (HTTP 403) a criação de novas cobranças/billing mesmo se alguém chamar a API
diretamente. Leituras, escrow e o webhook do AbacatePay continuam funcionando normalmente
(necessário para não travar pagamentos já em andamento).

Para a versão completa, basta omitir as variáveis (o padrão é `true` nos dois lados) ou
defini-las explicitamente como `true`.

## 8. Checklist de go-live

- [ ] `.env` de produção preenchido (sem segredos de exemplo)
- [ ] `NODE_ENV=production`
- [ ] `ABACATEPAY_WEBHOOK_SECRET` configurado (senão webhooks são rejeitados)
- [ ] `METRICS_TOKEN` definido (protege o dashboard)
- [ ] Segredos rotacionados se já tiverem sido expostos
- [ ] `Health Check Path = /health` na Render
- [ ] CORS: `FRONTEND_URL` aponta para o domínio real do frontend
- [ ] `npm test` passando
- [ ] Logs sendo gravados em `logs/` (rotação ativa)
