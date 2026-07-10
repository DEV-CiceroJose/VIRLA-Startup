# VIRLA — Roadmap das Melhorias (Fabio Henrique)

> Planejamento das 24 tasks recebidas em 30/06/2026. **Nenhum código foi alterado** —
> este documento é só o plano, ancorado no estado atual do repositório.
> Legenda de esforço: **P** ≤0,5 dia · **M** 1–2 dias · **G** 3–5 dias · **XG** >5 dias.

## Diagnóstico rápido do que já existe

O backend está **mais maduro do que a lista sugere**. Já há:

- **Validação Zod** em todas as rotas (`validateZod` + `schemas/*`) → SEC-02 está ~90% pronto.
- **CPF** validado por dígitos verificadores (`utils/cpf.js`); **e-mail** por formato (`utils/email.js`).
- **Unicidade de e-mail** no cadastro e no update (`emailExists`).
- **Limites de tamanho** (`.max()`) na maioria dos campos → SEC-05 quase pronto.
- **Rate limiting**, `helmet`, autorização/ownership (anti-IDOR), `requireRole`.
- **UI kit** pronto: `Button, Field, Card, Badge, Alert, ConfirmDialog, EmptyState`.

O que **falta de base** (vira dependência de várias tasks):

- ❌ **Nenhum envio de e-mail** (sem SMTP/Resend/SendGrid). Bloqueia SEC-01 e FEAT-01.
- ❌ **Sessão é JWT stateless de 7 dias** — não dá para invalidar no logout nem por inatividade sem um store. Bloqueia SEC-03.
- ❌ **Sem validação de data de nascimento** (`birthDate: z.string().optional().nullable()`). Bloqueia BUG-02 e SEC-06.

---

## Decisões que preciso de você antes de codar (bloqueiam fases 2–3)

1. **Provedor de e-mail** (SEC-01, FEAT-01): Resend / SendGrid / SMTP próprio? Custo x setup.
2. **Estratégia de sessão** (SEC-03): manter JWT + logout no cliente + expiração curta (simples), ou introduzir refresh token + blocklist no Firestore (robusto, mais caro)?
3. **Escopo do CHAT-02**: é um guarda-chuva de 8 features. Definir MVP (ex.: typing + read receipts) vs. pacote completo (imagens/arquivos = storage).

---

## Fase 0 — Correções críticas / quick wins (≈1–2 dias)

Sem dependências, alto valor, baixo custo. Fazer primeiro.

| Task | Esforço | O quê / onde |
|------|---------|--------------|
| **BUG-01** | **P** | Causa-raiz achada: `PUT /solicitacoes/:id` usa `createSolicitacaoBodySchema` onde `cidade`/`estado` são `.optional()` mas não `.nullable()`. Solicitação salva com `null` reenvia `null` → *"Esperava-se uma string…"*. Corrigir com `.nullable()` (ou schema de update dedicado). `schemas/solicitacaoSchemas.js` |
| **BUG-02** | **M** | Criar `utils/date.js` (formato válido, sem data futura, idade mínima) e refine em `birthDate` nos schemas de create/update. Base para SEC-06. |
| **SEC-05** | **P** | ✅ **Concluído (branch `fase2-form-ux`):** única lacuna era `specialties` (sem limite) — agora `z.array(z.enum(...)).max(12)`. Demais campos já tinham `.max()`. |
| **FE-12** | **P** | Confirmação de senha no `pages/Cadastro` (só frontend). |
| **CHAT-03** | **P** | Reusar `ui/ConfirmDialog` em excluir mensagem / cancelar solicitação / sair de conversa. |

## Fase 1 — Endurecimento de validações (≈3–5 dias) — depende de BUG-02

> ✅ **Concluído no branch `fase2-form-ux` (2026-07-04):** FE-01, FE-02 (só CEP→cidade/estado; sem bairro/rua), FE-03, FE-06 (lista fixa de 12 especialidades como multi-select), FE-07 (limite real da bio é 2000, não 500), FE-10 e FE-11. SEC-06/SEC-04/FE-08/FE-04/FE-05/FE-09 já haviam sido concluídos nas Fases 0/1 anteriores.

| Task | Esforço | O quê / onde |
|------|---------|--------------|
| **SEC-06** | **P** | Bloquear cuidador <18 anos — reusa o util de data do BUG-02, refine condicional a `role==='CUIDADOR'`. |
| **SEC-04** | **M** | Unicidade de **CPF** e **registro profissional** (e-mail já existe). Add `cpfExists`/`registerExists` no `userRepository` + checagem no `userController`. Anotar janela de corrida (mesma nota do e-mail). |
| **FE-08** | **P** | Validação de Nome (sem números/símbolos/sequências) — regex no schema + no form. |
| **FE-04** | **P** | `hourlyRate` com mín/máx (ex.: R$10–R$500) no schema + máscara no front. |
| **FE-05** | **M** | Formato de registro por conselho (COREN/CRM/CRP/CREFITO…) — mapa de regex no backend. |
| **FE-09** | **P** | Upload: whitelist de formato (.jpg/.jpeg/.png/.webp) + limite de tamanho. `ProfileImageUpload` + `profileImageSchema`. |
| **FE-01** | **P** | UF como `<select>` (27 estados) — `state` já é `max(2)` no backend. Só front. |
| **FE-03** | **P** | Máscara monetária (R$ 25,00) no Valor por Hora. Front (`utils/formatters`). |
| **FE-06** | **M** | Especialidades como tags/multi-select — backend já aceita array (`parseSpecialties`); falta a UI. |
| **FE-07** | **P** | Contador de caracteres na Bio (500) — `bio` já tem `.max` no backend. Front. |
| **FE-11** | **P** | Destaque visual de obrigatórios + mensagens claras — usar `ui/Field`/`Alert`. |
| **FE-10** | **M** | Aviso de perfil incompleto detalhado + % de conclusão. Front (deriva dos campos do user). |
| **FE-02** | **M** | CEP com autopreenchimento via ViaCEP (estado/cidade/bairro/rua). Front + campos novos. |

## Fase 2 — Infra de e-mail + fluxos de conta (≈5–8 dias) — precisa da decisão #1

| Task | Esforço | O quê |
|------|---------|-------|
| **(base)** | **M** | Serviço de envio de e-mail (provedor escolhido) + store de tokens com expiração no Firestore. |
| **FEAT-01** | **G** | "Esqueci minha senha": endpoints de request/reset com token expirável + telas. |
| **SEC-01** | **G** | Verificação de e-mail no cadastro (link/código); bloquear login/ações até confirmar. |

## Fase 3 — Segurança de sessão (≈2–4 dias) — precisa da decisão #2

| Task | Esforço | O quê |
|------|---------|-------|
| **SEC-03** | **M–G** | Logout que invalida sessão + expiração por inatividade. Depende da estratégia escolhida (JWT curto vs. refresh+blocklist). |

## Fase 4 — Chat & Produto (≈8–12 dias) — precisa da decisão #3

> ✅ **Concluído no branch `chat-features` (2026-07-05):** CHAT-01 (apagar mensagem própria em janela de 10min, tombstone "mensagem apagada") e "sair/arquivar conversa" (parte que faltava do antigo CHAT-03). Correção de premissa: o chat roda no **Realtime Database**, não no Firestore. Restam CHAT-02 (pacote grande), PROD-01/02/03.

| Task | Esforço | O quê |
|------|---------|-------|
| **CHAT-01** | **M** | ✅ **Concluído (branch `chat-features`):** apagar mensagem própria em janela de 10min (tombstone). Feito no RTDB (não Firestore) + UI com ConfirmDialog. |
| **PROD-01 + "visto por último" (CHAT-02)** | **M** | ✅ **Concluído (branch `chat-presence`, 2026-07-05):** presença online + "visto por último" no header do Chat, via RTDB `onDisconnect` (não Firestore). Correção de premissa: presença vive no **RTDB**, não no Firestore. |
| **CHAT-02 (restante)** | **XG** | ✅ **Concluído.** Guarda-chuva decomposto e fechado: typing, leitura (✓✓), envio (✓), presença/visto por último (branch `chat-presence`), **emojis** (seletor próprio no composer) e **imagens+arquivos** (imagem/PDF via disco local, branch `chat-anexos-emojis`, 2026-07-09). CHAT-02 encerrado. |
| **PROD-02** | **M** | Tela de solicitações completa (localização, valor, horário, frequência, início). Alguns campos podem não existir ainda no modelo. |
| **PROD-03** | **G** | Sistema de notificações (mensagens, solicitações, status). Overlap com presença/chat. |

---

## 🆕 Achados em teste manual (02/07/2026 — pós-migração Firebase Auth)

Encontrados testando a branch `tasks-dev` no navegador após a migração de login para Firebase Auth.

| Task | Esforço | Área | Descrição |
|------|---------|------|-----------|
| **FEED-01** | **P** | frontend | No Feed (`pages/Feed/index.jsx:269`), bug de pluralização: `'perfil' + 'is'` produz "5 perfilis no total" (correto: "perfis"). Além do typo, avaliar se a contagem total de perfis deve mesmo ser exibida ao Familiar — feedback do usuário é que **não deveria aparecer**. Decidir: remover a contagem, ou só corrigir o texto. |
| **AUTH-01** | **M** | frontend / backend | Contas criadas via **login Google** não têm senha no Firebase Auth e hoje não existe nenhuma forma de definir uma (sem `linkWithCredential`/`EmailAuthProvider` no código). Se o usuário quiser também entrar com e-mail/senha (ou perder acesso à conta Google), fica sem saída. Adicionar um fluxo em `Perfil` para "criar senha" via `linkWithCredential(EmailAuthProvider.credential(email, senha))` quando `providerData` não incluir `password`. |
| **AUTH-02** | **M** | frontend | **Conta órfã em erro de validação.** No Cadastro, `registerWithEmail` cria a credencial no Firebase Auth *antes* do `POST /users`; se o backend rejeitar (422 de CPF/nome/registro/idade), fica uma conta no Firebase Auth sem perfil no Firestore. Achado na revisão da Fase 1 (pré-existente, não introduzido por ela). Mitigado parcialmente: validações agora replicadas no client (idade, CPF, nome, formato de registro) reduzem a janela; e o `POST /users` é idempotente no retry. Correção definitiva: ou POSTar o perfil **antes** de criar a credencial, ou deletar o usuário do Firebase Auth num 4xx do `/users`. |

**Confirmado em produção:** BUG-02 (data de nascimento futura aceita, gera "0 anos") — reproduzido na tela de Perfil com data 03/07/2026 sendo aceita antes da data-limite de hoje (02/07/2026). Já rastreado acima; nenhuma task nova necessária, só reforça a prioridade.

---

## Resumo por esforço

- **P (rápidas):** BUG-01, SEC-05, FE-12, CHAT-03, SEC-06, FE-08, FE-04, FE-09, FE-01, FE-03, FE-07, FE-11, FEED-01 → **13 tasks**
- **M:** BUG-02, SEC-04, FE-05, FE-06, FE-10, FE-02, CHAT-01, PROD-01/last-seen, PROD-02, SEC-03(±), AUTH-01 → **~11 tasks**
- **G:** FEAT-01, SEC-01, PROD-03, (SEC-03 no cenário robusto)
- **XG:** CHAT-02 (pacote completo)

**Sugestão de ordem:** Fase 0 (esta semana) → Fase 1 → escolher provedor/estratégia (decisões 1–2) → Fases 2–3 → Fase 4. FEED-01 e AUTH-01 (achados em teste manual) são independentes e podem entrar na Fase 0/1.

**Estimativa total grosseira:** ~4–6 semanas de dev focado para as 26 tasks; ~1 semana entrega as Fases 0+1 (16 tasks, todo o valor de correção rápida).
