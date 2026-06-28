# 🔧 CORREÇÕES REALIZADAS — Virla

> Registro detalhado de cada alteração de código. Data: **30/05/2026**.
> Todas as correções foram aplicadas **diretamente no código** e validadas (sintaxe, boot do servidor e testes).

**Resumo:** 13 problemas tratados · 19 arquivos modificados · 6 novos módulos · 9 arquivos de teste.

---

## 1. Controle de acesso e autenticação

### 1.1 Rotas de usuário protegidas (P-01)
**Arquivo:** `backend/src/routes/userRoutes.js`

- **Antes:** `GET /users`, `PUT /users/:id`, `DELETE /users/:id` sem qualquer autenticação.
- **Depois:** todas exigem `checkToken`; `PUT` valida o corpo com `updateUserBodySchema` (Zod, `.strict()`); `POST /users` ganhou rate limit.

```js
router.get('/users', checkToken, getUsers)
router.put('/users/:id', checkToken, validateZod(updateUserBodySchema), updateUsers)
router.delete('/users/:id', checkToken, deleteUsers)
```

### 1.2 Verificação de posse — anti-IDOR (P-01)
**Arquivo:** `backend/src/controllers/userController.js`

`updateUsers` e `deleteUsers` agora bloqueiam alteração/exclusão de contas de terceiros:

```js
if (req.userId !== req.params.id) {
  authLogger.warn('user:update_forbidden', { userId: req.userId, targetId: req.params.id, ip: req.ip })
  return res.status(403).json({ msg: 'Você só pode editar o próprio perfil.' })
}
```

**Verificação:** `PUT /users/:id` sem token → `401`; com token de outro usuário → `403`.

### 1.3 Separação de PII (P-02)
**Novo arquivo:** `backend/src/lib/userSelects.js`

- `USER_PUBLIC_SELECT` — sem `email`/`cpf` (feed e perfis de terceiros).
- `USER_SELF_SELECT` — inclui `email`/`cpf` (apenas o próprio usuário).
- `getUserById` decide pelo `req.userId === req.params.id`.

### 1.4 JWT com expiração (P-03)
**Arquivo:** `authController.js`

```js
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const token = jwt.sign({ id: user.id }, process.env.SECRET, { expiresIn: JWT_EXPIRES_IN })
```

### 1.5 Fim da enumeração de contas (P-04)
**Arquivo:** `authController.js` — resposta única para usuário inexistente e senha errada:

```js
const checkPassword = user ? await bcrypt.compare(password, user.password) : false
if (!user || !checkPassword) {
  authLogger.warn('auth:login_failed', { email, ip: req.ip, reason: user ? 'invalid_password' : 'user_not_found' })
  return res.status(401).json({ msg: 'Credenciais inválidas.' })
}
```

**Verificação:** 12 logins inválidos consecutivos → `401 ... 401 429 429` (rate limit ativo).

---

## 2. Hardening

### 2.1 Rate limiting (P-05)
**Novo arquivo:** `backend/src/middlewares/rateLimit.js` — limiter em memória com janela deslizante por IP, limpeza periódica (`setInterval().unref()`) e log de abuso em `security.log`.
- Login: 10 req/min · Cadastro: 5 req/min.
- `server.js`: `app.set('trust proxy', 1)` para obter o IP real atrás do proxy da Render.

### 2.2 Upload seguro (P-06)
**Arquivo:** `backend/src/config/upload.js` — `limits.fileSize` (10MB), `files: 1` e `fileFilter` por mimetype de áudio.
**Arquivo:** `backend/src/routes/messageRoutes.js` — wrapper `uploadAudio` converte erros do Multer em `413` (grande demais) / `422` (tipo inválido) em vez de `500`.

### 2.3 PII fora dos logs do gateway (P-08)
**Arquivo:** `abacatePayService.js` — substituído `console.info(JSON.stringify(body))` por `logger.debug`/`logger.info` apenas com metadados (sem nome/e-mail/CPF).

### 2.4 Template de variáveis de ambiente (P-13)
**Novo arquivo:** `backend/.env.example` — todas as variáveis documentadas, sem segredos reais.

---

## 3. Sistema de logs (P-07, P-10)

### 3.1 Logger profissional
**Arquivo:** `backend/src/lib/logger.js` (reescrito)
- **5 níveis customizados:** `fatal` < `error` < `warn` < `info` < `debug`.
- **Formato JSON estruturado** (timestamp ms, level, message, stack, metadados).
- **Rotação automática** por tamanho: 5MB × 5 arquivos por stream (configurável por env).
- **4 streams:** `app.log`, `errors.log`, `auth.log`, `messages.log`, **`security.log`** (novo).
- Helper **`formatError(error, ctx)`** → extrai `message`, `stack`, `file`, `line`, `userId`, `endpoint`.
- Console colorizado por nível para desenvolvimento.

### 3.2 Substituição de `console.*`
34 ocorrências em 9 arquivos migradas para o logger estruturado:

| Arquivo | Logger usado |
|---------|--------------|
| `webhookController.js` | `securityLogger` (assinatura/segredo) + `logger` |
| `messageController.js` | `messageLogger` |
| `paymentController.js` | `logger` |
| `chargeRequestController.js` | `logger` |
| `escrowController.js` | `logger` |
| `escrowService.js` | `logger` |
| `paymentWebhookService.js` | `logger` |
| `abacatePayService.js` | `logger` (sem PII) |
| `crypto.js` | `logger` (mantido `console.error` apenas no guard de pré-boot) |

Eventos de **autenticação** (login ok/falha, cadastro, exclusão, acessos negados) e **segurança** (CORS bloqueado, assinatura de webhook inválida, rate limit) passaram a ser registrados.

---

## 4. Observabilidade (Tarefa 4)

### 4.1 Métricas em memória
**Novo arquivo:** `backend/src/lib/metrics.js` — contadores agregados (requisições, erros, tempo médio), erros por dia, por endpoint, top endpoints, mais lentos e buffer circular dos últimos 50 erros. Normaliza IDs nas rotas (`/users/123` → `/users/:id`).

### 4.2 Middleware de request logging
**Novo arquivo:** `backend/src/middlewares/requestLogger.js` — loga cada requisição no `finish` (método, rota, status, duração, usuário, IP) e alimenta as métricas. Ignora `/health`, `/observability`, `/uploads`.

### 4.3 Health check real
**Novo arquivo:** `backend/src/controllers/observabilityController.js`
- `GET /health` → `{ status, database, memory, apis, details, ... }`; `503` quando degradado. Verifica **banco (ping com timeout), memória (heap), CPU e configuração de APIs**.
- `GET /observability/dashboard` → métricas agregadas; protegido por `METRICS_TOKEN` (obrigatório em produção).

**Verificação real (servidor em execução, banco conectado):**
```json
{"status":"ok","database":"ok","memory":"ok","apis":"ok",
 "details":{"memory":{"rssMb":82,"heapUsedPct":48},"apis":{"abacatepay":"configured"}}}
```

---

## 5. Qualidade de código e bugs

- **`escrowController.js`** — removido ternário redundante `result.idempotent ? 200 : 200` → `res.status(200)`.
- **`userController.js`** — `updateUsers`/`deleteUsers` agora têm `try/catch` com tratamento de `P2002` (e-mail duplicado) e log estruturado.
- **`crypto.js`** — erro de descriptografia agora vai ao `logger`.

---

## 6. Testes (P-11)

**Novos arquivos:** `backend/tests/*.test.js` (9 arquivos, **32 testes**, runner nativo `node:test`).

| Suíte | Foco |
|-------|------|
| `cpf.test.js` | validação de CPF (dígitos, repetidos, tamanho) |
| `email.test.js` | validação de e-mail |
| `paymentFees.test.js` | cálculo de taxas (7% + R$0,80) |
| `validation.test.js` | ObjectId, valores em centavos, idempotency key |
| `escrowStateMachine.test.js` | transições válidas/inválidas e estado terminal |
| `crypto.test.js` | round-trip encrypt/decrypt + casos de borda |
| `abacatePayService.test.js` | validação de CPF/e-mail do gateway |
| `logger.test.js` | níveis e `formatError` |
| `metrics.test.js` | agregação e normalização de rotas |

**Scripts adicionados** (`package.json`): `npm test` e `npm run test:coverage`.

**Resultado:** `32 pass / 0 fail`. Cobertura da lógica de negócio testada: CPF 100%, e-mail 100%, paymentFees 100%, validation ~100%, escrowStateMachine 100%, logger 100%, metrics 100%, crypto 93%.

---

## 7. Lista de arquivos

**Modificados (19):** `server.js`, `package.json`, `config/upload.js`, `controllers/{auth,charge­Request,escrow,message,payment,user,webhook}Controller.js`, `lib/{crypto,logger}.js`, `routes/{auth,message,user}Routes.js`, `schemas/userSchemas.js`, `services/{abacatePay,escrow,paymentWebhook}Service.js`.

**Criados (6 módulos):** `.env.example`, `controllers/observabilityController.js`, `lib/metrics.js`, `lib/userSelects.js`, `middlewares/rateLimit.js`, `middlewares/requestLogger.js`.

**Criados (testes):** 9 arquivos em `tests/`.
