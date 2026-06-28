# 📊 ANÁLISE DO SISTEMA — Virla

> Análise técnica completa do backend e frontend do projeto Virla, realizada em **30/05/2026**.
> Foco em segurança, estabilidade, observabilidade e qualidade de código.

---

## 1. Visão Geral da Arquitetura

| Camada | Stack | Observação |
|--------|-------|------------|
| **Backend** | Node.js 24 (ESM), Express 5, Prisma 6 + MongoDB Atlas, Socket.io 4, Winston, Zod, bcrypt, JWT | ~2.500 LOC / 31 arquivos |
| **Frontend** | React 19, Vite 8, MUI 9, React Router 7, Axios, socket.io-client, Sonner | ~4.400 LOC / 30 arquivos |
| **Pagamentos** | Integração AbacatePay (PIX) + máquina de custódia (Escrow) | Idempotência + auditoria |
| **Deploy** | Render (backend + frontend) | Plano free/starter |

**Estrutura de pastas (backend/src):** `config/`, `controllers/`, `events/` (socket), `lib/` (prisma, crypto, logger), `middlewares/`, `routes/`, `schemas/` (Zod), `services/` (abacatepay, escrow, webhook), `utils/`.

**Pontos fortes encontrados** (código maduro, mantido como está):
- Subsistema de **Escrow** com máquina de estados, **idempotência**, `updateMany` condicional anti-race e trilha de auditoria imutável.
- **Webhook** AbacatePay com verificação de assinatura HMAC-SHA256 *timing-safe*.
- **Graceful shutdown**, `unhandledRejection`/`uncaughtException` tratados.
- **CORS** centralizado e reutilizado entre Express e Socket.io.
- **Criptografia AES-256-CBC** das mensagens em repouso, com IV aleatório por mensagem.
- Validação de entrada com **Zod** + validação de CPF por dígitos verificadores.

---

## 2. Problemas Encontrados

A criticidade segue: 🔴 **CRÍTICO** · 🟠 **ALTO** · 🟡 **MÉDIO** · 🔵 **BAIXO**.

### 🔴 P-01 — Broken Access Control nas rotas de usuário
- **Arquivos:** `backend/src/routes/userRoutes.js`, `backend/src/controllers/userController.js`
- **Descrição:** `GET /users`, `PUT /users/:id` e `DELETE /users/:id` **não exigiam autenticação**. Qualquer pessoa, sem token, podia:
  - Listar **todos** os usuários (com **e-mail e CPF** — vazamento de PII em massa).
  - **Editar** o perfil de qualquer usuário.
  - **Excluir** a conta de qualquer usuário.
- **Causa:** middleware `checkToken` ausente nas rotas; ausência de verificação de posse (ownership).
- **Solução recomendada/aplicada:** exigir `checkToken`; impor `req.userId === req.params.id` em update/delete; validar corpo do update com Zod (`.strict()`).

### 🔴 P-02 — Exposição de PII entre usuários (e-mail/CPF)
- **Arquivos:** `backend/src/controllers/authController.js` (`getUserById`), `userController.js` (`getFeedUsers`, `getUsers`)
- **Descrição:** o `select` público incluía `email` e `cpf`. Ao abrir o perfil de um terceiro (página de cuidador) ou o feed, o backend retornava e-mail e CPF de outros usuários, embora a UI não os exiba.
- **Causa:** um único `USER_PUBLIC_SELECT` usado tanto para "eu" quanto para "terceiros".
- **Solução aplicada:** dois selects — `USER_SELF_SELECT` (com PII, só para o próprio) e `USER_PUBLIC_SELECT` (sem PII, para terceiros/feed).

### 🟠 P-03 — JWT sem expiração
- **Arquivo:** `backend/src/controllers/authController.js` (`LoginUser`)
- **Descrição:** `jwt.sign({ id }, SECRET)` gerava tokens **sem `expiresIn`** — válidos para sempre. Um token vazado nunca expira.
- **Solução aplicada:** `expiresIn` configurável via `JWT_EXPIRES_IN` (padrão `7d`).

### 🟠 P-04 — Enumeração de contas no login
- **Arquivo:** `authController.js`
- **Descrição:** respostas distintas para "usuário não encontrado" (404) e "senha inválida" (422) permitiam descobrir quais e-mails existem.
- **Solução aplicada:** resposta única `401 Credenciais inválidas.` para ambos os casos.

### 🟠 P-05 — Ausência de rate limiting (força bruta)
- **Arquivos:** `authRoutes.js`, `userRoutes.js`
- **Descrição:** login e cadastro sem limite de tentativas — sujeitos a brute force e abuso de criação de contas.
- **Solução aplicada:** middleware `rateLimit` em memória (login 10/min, cadastro 5/min por IP) + `trust proxy` para IP real atrás da Render.

### 🟡 P-06 — Upload sem limite de tamanho nem validação de tipo
- **Arquivo:** `backend/src/config/upload.js`
- **Descrição:** `multer` aceitava arquivos de qualquer tamanho e qualquer tipo (salvos como `.webm`). Risco de DoS por arquivos gigantes e armazenamento de conteúdo arbitrário.
- **Solução aplicada:** `limits.fileSize` (10MB) + `fileFilter` por mimetype de áudio + tratamento de erro 413/422.

### 🟡 P-07 — Logging inconsistente (console.* espalhado)
- **Arquivos:** 9 controllers/services (34 ocorrências de `console.*`)
- **Descrição:** o projeto já tinha Winston, mas a maior parte dos erros usava `console.error/warn/info`, sem estrutura, sem stack, sem contexto (usuário/endpoint) e sem ir para arquivo.
- **Solução aplicada:** substituição por `logger`/`authLogger`/`messageLogger`/`securityLogger` com payload JSON estruturado.

### 🟡 P-08 — Vazamento de PII nos logs do gateway
- **Arquivo:** `backend/src/services/abacatePayService.js`
- **Descrição:** `console.info(JSON.stringify(body))` logava o corpo completo das requisições ao AbacatePay, incluindo **nome, e-mail e CPF** do cliente.
- **Solução aplicada:** log apenas de metadados (label, status, valor) — PII removida dos logs.

### 🟡 P-09 — `/health` superficial
- **Arquivo:** `backend/server.js`
- **Descrição:** o health check só devolvia `{status:'ok'}` fixo, sem checar banco, memória ou dependências. A Render não conseguia detectar degradação real.
- **Solução aplicada:** `/health` agora verifica **banco (ping), memória, CPU e configuração de APIs**, retornando `503` quando degradado.

### 🟡 P-10 — Logs sem rotação (crescimento ilimitado)
- **Arquivo:** `backend/src/lib/logger.js`
- **Descrição:** transports de arquivo sem `maxsize`/`maxFiles`. O `auth.log` já estava em **259 KB** e crescia sem limite (risco de encher o disco).
- **Solução aplicada:** rotação nativa por tamanho (5MB × 5 arquivos por stream).

### 🔵 P-11 — Ausência de testes automatizados
- **Descrição:** `npm test` retornava erro fixo; nenhuma cobertura.
- **Solução aplicada:** suíte com `node:test` (32 testes) cobrindo a lógica de negócio pura (CPF, e-mail, taxas, validação, máquina de estados, criptografia, logger, métricas).

### 🔵 P-12 — Bug cosmético / código morto
- **Arquivo:** `escrowController.js` — `res.status(result.idempotent ? 200 : 200)` (ternário redundante). Corrigido.

### 🔵 P-13 — Segredos reais no `.env` de trabalho
- **Arquivo:** `backend/.env`
- **Observação:** o `.env` **não está versionado** (corretamente ignorado pelo `.gitignore`). Porém contém credenciais reais (MongoDB, JWT SECRET, token AbacatePay, ENCRYPTION_KEY). Como foram expostas neste ambiente, **recomenda-se rotacioná-las**. Criado `.env.example` como template seguro.

---

## 3. Matriz de Criticidade

| ID | Problema | Criticidade | Arquivos | Status |
|----|----------|:-----------:|----------|:------:|
| P-01 | Broken Access Control (users) | 🔴 Crítico | userRoutes/userController | ✅ Corrigido |
| P-02 | PII (e-mail/CPF) entre usuários | 🔴 Crítico | authController/userController | ✅ Corrigido |
| P-03 | JWT sem expiração | 🟠 Alto | authController | ✅ Corrigido |
| P-04 | Enumeração de contas | 🟠 Alto | authController | ✅ Corrigido |
| P-05 | Sem rate limiting | 🟠 Alto | authRoutes/userRoutes | ✅ Corrigido |
| P-06 | Upload sem limites | 🟡 Médio | config/upload | ✅ Corrigido |
| P-07 | Logging inconsistente | 🟡 Médio | 9 arquivos | ✅ Corrigido |
| P-08 | PII nos logs do gateway | 🟡 Médio | abacatePayService | ✅ Corrigido |
| P-09 | /health superficial | 🟡 Médio | server.js | ✅ Corrigido |
| P-10 | Logs sem rotação | 🟡 Médio | lib/logger | ✅ Corrigido |
| P-11 | Sem testes | 🔵 Baixo | — | ✅ Corrigido |
| P-12 | Ternário redundante | 🔵 Baixo | escrowController | ✅ Corrigido |
| P-13 | Segredos no .env | 🔵 Info | .env | ⚠️ Rotacionar |

---

## 4. Itens analisados e considerados OK (sem ação)

- **Express 5 async errors:** controllers sem `try/catch` ainda têm rejeições encaminhadas automaticamente ao error handler global (comportamento nativo do Express 5).
- **Prisma singleton:** `lib/prisma.js` evita múltiplas conexões em hot-reload — correto.
- **Webhook signature:** HMAC + `timingSafeEqual` corretos; rejeita em produção se o secret faltar.
- **Race conditions de pagamento:** `holdEscrowFunds`/`transitionEscrowWithIdempotency` usam `updateMany` condicional + idempotência — robustos.
- **decrypt defensivo:** retorna "Mensagem corrompida" em vez de lançar.
- **CORS:** lista centralizada, reutilizada por Express e Socket.io.

---

## 5. Recomendações futuras (fora do escopo aplicado)

1. **Logout real / blacklist de tokens** ou tokens de curta duração + refresh token.
2. **Cobertura de integração** com banco de teste (`mongodb-memory-server`) para chegar a 80% incluindo controllers.
3. **Helmet** para headers de segurança HTTP no Express.
4. **Migrar token do `localStorage`** (frontend) para cookie httpOnly, reduzindo superfície de XSS.
5. **Rate limiter distribuído** (Redis) se escalar para múltiplas instâncias.
6. **Sentry/observabilidade externa** para alertas proativos de erro.

> Detalhe das correções em **CORRECOES_REALIZADAS.md** · sistema de logs em **GUIA_DE_LOGS.md** · deploy em **GUIA_DE_DEPLOY.md** · resumo executivo em **RELATORIO_FINAL.md**.
