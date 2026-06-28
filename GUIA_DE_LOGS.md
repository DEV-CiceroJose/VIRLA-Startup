# 📒 GUIA DE LOGS E OBSERVABILIDADE — Virla

Como o sistema de logs funciona, como usá-lo e como monitorar a aplicação.

---

## 1. Arquitetura de logging

O logging usa **Winston** com níveis customizados e rotação automática. Definido em
[`backend/src/lib/logger.js`](backend/src/lib/logger.js).

### Loggers disponíveis

```js
import { logger, authLogger, messageLogger, securityLogger, formatError } from './lib/logger.js'
```

| Logger | Arquivo(s) | Uso |
|--------|-----------|-----|
| `logger` | `app.log` + `errors.log` | Geral da aplicação (HTTP, pagamentos, banco) |
| `authLogger` | `auth.log` + `errors.log` | Login, logout, cadastro, tokens, acessos negados |
| `messageLogger` | `messages.log` + `errors.log` | Chat / mensagens |
| `securityLogger` | `security.log` + `errors.log` | CORS bloqueado, webhook inválido, rate limit, abuso |

> Todos os erros (`level: error`/`fatal`) são duplicados em `errors.log`, independentemente do stream de origem.

---

## 2. Níveis de log

Ordem de severidade (do mais grave ao mais verboso):

| Nível | Quando usar |
|-------|-------------|
| `fatal` | Falha que derruba/compromete o processo |
| `error` | Erro tratado que precisa de atenção (exceção, falha de gateway/banco) |
| `warn` | Situação anômala mas recuperável (auth ausente, timeout do gateway, rate limit) |
| `info` | Eventos de negócio normais (login, requisição, pagamento, transição de escrow) |
| `debug` | Detalhe de diagnóstico (payload de requisição ao gateway) |

Configure o nível mínimo via env:

```bash
LOG_LEVEL=info     # produção (padrão)
LOG_LEVEL=debug    # diagnóstico detalhado
```

---

## 3. Formato dos logs

Os arquivos são **JSON estruturado**, um objeto por linha (JSON Lines):

```json
{
  "level": "error",
  "message": "payment:initiate_failed",
  "timestamp": "2026-05-30 20:47:56.123",
  "error": "connection timeout",
  "stack": "Error: connection timeout\n    at ...",
  "userId": "507f1f77bcf86cd799439011",
  "endpoint": "/payments/billing"
}
```

O console (desenvolvimento) usa formato colorizado e compacto:

```
20:47:56 info  http:request {"method":"POST","path":"/auth/login","statusCode":200,"durationMs":42}
```

### Helper `formatError`

Para padronizar a captura de exceções com **arquivo e linha**:

```js
import { formatError, logger } from './lib/logger.js'

try { /* ... */ } catch (err) {
  logger.error('modulo:operacao_falhou', formatError(err, { userId: req.userId, endpoint: req.originalUrl }))
}
```

Retorna `{ message, stack, file, line, userId, endpoint }`.

---

## 4. Rotação de logs

Rotação **nativa por tamanho** (sem dependências extras):

- Ao atingir `maxsize`, o Winston cria `app1.log`, `app2.log`, … e descarta os mais antigos além de `maxFiles`.
- Padrões: **5 MB por arquivo**, **5 arquivos por stream**.

```bash
LOG_MAX_SIZE=5242880   # bytes por arquivo (5MB)
LOG_MAX_FILES=5        # arquivos mantidos por stream
LOG_DIR=logs           # diretório (criado automaticamente)
```

> Os arquivos `*.log` estão no `.gitignore` — nunca são versionados.

---

## 5. Eventos registrados

| Evento | Logger | Exemplo de `message` |
|--------|--------|----------------------|
| Inicialização | `logger` | `server:started` |
| Login OK / falha | `authLogger` | `auth:login_success` / `auth:login_failed` |
| Cadastro | `authLogger` | `auth:register_success` |
| Exclusão de conta | `authLogger` | `user:deleted` |
| Acesso negado (IDOR) | `authLogger` | `user:update_forbidden` |
| Requisição HTTP | `logger` | `http:request` (com `durationMs`) |
| Erro de banco | `messageLogger`/`logger` | `*_failed` com `dbDown` |
| Erro de API externa | `logger` | `payment:gateway_error` |
| Conexão/desconexão socket | `authLogger` | `socket:connected` / `socket:disconnected` |
| CORS bloqueado | `securityLogger` | `cors:blocked` |
| Webhook inválido | `securityLogger` | `webhook:invalid_signature` |
| Rate limit excedido | `securityLogger` | `ratelimit:exceeded` |

---

## 6. Observabilidade

### 6.1 Health check — `GET /health`

Verifica banco, memória, CPU e configuração de APIs. Retorna `200` (ok) ou `503` (degradado).

```json
{
  "status": "ok",
  "env": "production",
  "uptimeSeconds": 3600,
  "database": "ok",
  "memory": "ok",
  "apis": "ok",
  "details": {
    "database": { "ok": true },
    "memory": { "rssMb": 82, "heapUsedMb": 17, "heapUsedPct": 48 },
    "apis": { "abacatepay": "configured" },
    "cpu": { "userMs": 578, "systemMs": 812 }
  }
}
```

> Configure este endpoint como **Health Check Path** na Render.

### 6.2 Dashboard de métricas — `GET /observability/dashboard`

Retorna métricas agregadas em tempo real:

```json
{
  "uptimeSeconds": 3600,
  "totalRequests": 1240,
  "totalErrors": 3,
  "avgResponseMs": 38,
  "errorsByDay": { "2026-05-30": 3 },
  "topEndpoints": [ { "endpoint": "GET /users/:id", "count": 410, "avgResponseMs": 22 } ],
  "errorsByEndpoint": [ { "endpoint": "POST /payments/billing", "errors": 2 } ],
  "slowestEndpoints": [ ... ],
  "recentErrors": [ { "timestamp": "...", "endpoint": "...", "statusCode": 500, "userId": "..." } ]
}
```

**Proteção:** em produção exige o header `x-metrics-token` igual à env `METRICS_TOKEN`.

```bash
curl -H "x-metrics-token: SEU_TOKEN" https://virla-api.onrender.com/observability/dashboard
```

Em desenvolvimento (sem `METRICS_TOKEN`) o acesso é liberado.

---

## 7. Consultas úteis (PowerShell / shell)

```powershell
# Últimos 20 erros
Get-Content backend/logs/errors.log -Tail 20

# Filtrar falhas de login
Select-String -Path backend/logs/auth.log -Pattern "login_failed"

# Contar erros por mensagem (PowerShell)
Get-Content backend/logs/errors.log | ConvertFrom-Json | Group-Object message | Sort-Object Count -Descending
```

```bash
# (bash) erros mais frequentes
cat backend/logs/errors.log | jq -r .message | sort | uniq -c | sort -rn | head
```
