# Design — Fase 0: Correções e Validações

**Data:** 2026-07-02
**Branch:** `fase0-validacoes-fixes` (sai de `tasks-dev`, pois AUTH-01 depende do Firebase Auth)
**Contexto:** primeira fase do roadmap pós-migração Firebase Auth. Quatro tasks
independentes, achadas no roadmap do Fabio + testes manuais.
**Status:** aprovado no brainstorming; pendente de plano de implementação.

## Escopo

Quatro correções independentes:

1. **BUG-01** — erro ao editar solicitação salva (backend)
2. **BUG-02 + SEC-06** — validação de data de nascimento / idade 18+ (backend + frontend)
3. **FEED-01** — contagem "X perfis no total" no Feed (frontend)
4. **AUTH-01** — permitir que conta criada via Google defina uma senha (frontend)

Não há dependência entre elas; podem ser implementadas em qualquer ordem.

---

## 1. BUG-01 — Erro ao editar solicitação salva

**Causa-raiz:** `PUT /solicitacoes/:id` reusa `createSolicitacaoBodySchema`
([solicitacaoSchemas.js](../../backend/src/schemas/solicitacaoSchemas.js)), onde
`cidade` e `estado` são `.optional()` mas **não** `.nullable()`. Uma solicitação
salva sem cidade/estado guarda `null`; ao reeditar, o frontend reenvia `null` →
Zod lança *"Esperava-se uma string, mas foi recebido um valor nulo"*.

**Mudança:** adicionar `.nullable()` a `cidade` e `estado` no
`createSolicitacaoBodySchema`. O controller já normaliza com
`cidade?.trim() || null`, então nada mais muda.

```js
cidade: z.string().max(80).optional().nullable(),
estado: z.string().max(2).optional().nullable(),
```

**Teste:** `createSolicitacaoBodySchema.safeParse({ titulo, descricao, cidade: null, estado: null })` → `success === true`.

---

## 2. BUG-02 + SEC-06 — Validação de data de nascimento (18+ para todos)

**Regra:** idade mínima **18 anos** para CUIDADOR **e** FAMILIAR. Rejeitar data
futura, data inválida e datas absurdas (idade > 110). `birthDate` passa a ser
**obrigatório no cadastro** (Cadastro por e-mail/senha e Completar cadastro do
Google) e continua editável no Perfil.

### Backend

**Novo `backend/src/utils/date.js`:**

- `calculateAge(birthDate, now = new Date())` → número de anos completos.
- `validateBirthDate(value, { minAge = 18 })` → `{ valid: true, date }` ou
  `{ valid: false, error }`. Rejeita: não-data / `NaN`, data futura, idade
  `< minAge`, idade `> 110`.

**Schemas (`userSchemas.js`):**

- `birthDateSchema` (string) com `.refine` chamando `validateBirthDate`. Mensagens
  pt-BR: "Data de nascimento inválida.", "Data de nascimento não pode ser futura.",
  "É necessário ter pelo menos 18 anos.".
- `createUserBodySchema`: `birthDate` **obrigatório** (`birthDateSchema`, sem
  `.optional()`).
- `updateUserBodySchema`: `birthDate` **opcional/nullable** mas validado quando
  presente (`birthDateSchema.optional().nullable()` — aceita `null`/ausente, mas
  se vier uma data, ela precisa passar em `validateBirthDate`).

O `parseBirthDate` do `userController` permanece só para converter a string em
`Date` antes de gravar no Firestore; a validação vive no Zod (retorna 422).

### Frontend

- **Cadastro** (`pages/Cadastro/index.jsx`): adicionar um `<Field type="date">`
  (obrigatório) para data de nascimento; incluir `birthDate` no payload do
  `POST /users`. Validação leve no cliente (campo preenchido); o backend é a
  fonte de verdade para 18+/futura.
- **CompletarCadastro** (`pages/CompletarCadastro/index.jsx`): idem — adicionar o
  campo de data (obrigatório) e enviá-lo no `POST /users`.
- **Perfil** (`pages/Perfil/index.jsx`): já tem o campo; passa a exibir a
  mensagem de erro 422 do backend (o handler de erro já mostra `message`).

**Testes (backend):** `date.js` — data válida (idade ok), data futura, idade
`< 18`, string inválida, idade `> 110`. Schema — `birthDate` ausente no create →
falha; data futura → falha; 18+ válida → ok; update sem birthDate → ok.

---

## 3. FEED-01 — Contagem no Feed

**Contexto:** [Feed/index.jsx:269](../../frontend/src/pages/Feed/index.jsx#L269)
renderiza `{total} perfil{total !== 1 ? 'is' : ''} no total`, gerando "perfilis"
(bug de pluralização) e expondo a contagem total ao Familiar — que, por decisão
do usuário, não deve aparecer.

**Mudança:** remover a linha do total; manter apenas a paginação quando houver
mais de uma página.

```jsx
{totalPages > 1 && (
  <p className="text-virla-muted text-sm">
    Página {page} de {totalPages}
  </p>
)}
```

Remover o state `total`/`setTotal` (fica sem uso após remover o display) e a
linha `setTotal(...)` no fetch; manter `totalPages`/`setTotalPages` (usados na
paginação). Isso elimina o typo por eliminação da string.

**Teste:** o Feed não deve renderizar o texto "no total"; a paginação continua
aparecendo quando `totalPages > 1`.

---

## 4. AUTH-01 — Criar senha para conta Google

**Contexto:** contas criadas via `signInWithPopup(Google)` não têm provedor de
senha no Firebase Auth, e não há forma de definir uma (não existe
`linkWithCredential`/`EmailAuthProvider` no código). Se o usuário perder acesso à
conta Google ou quiser entrar por e-mail/senha, fica sem saída.

**É 100% client-side (Firebase).** O `uid` e o e-mail não mudam ao vincular a
credencial de senha, então o perfil no backend permanece intacto — nenhuma
mudança de backend.

### `services/auth.js`

- `hasPasswordProvider()` → `firebaseAuth.currentUser?.providerData.some(p => p.providerId === 'password') === true`.
- `linkPassword(novaSenha)` →
  `linkWithCredential(firebaseAuth.currentUser, EmailAuthProvider.credential(firebaseAuth.currentUser.email, novaSenha))`.
- Imports novos: `EmailAuthProvider`, `linkWithCredential` de `firebase/auth`.
- `mapAuthError` ganha: `auth/requires-recent-login` ("Faça login novamente para
  criar sua senha."), `auth/weak-password` (já existe), `auth/credential-already-in-use`
  ("Esta conta já possui uma senha.").

### `pages/Perfil/index.jsx`

- Seção **"Criar senha"** renderizada **apenas** quando `!hasPasswordProvider()`
  (conta Google-only). Campos: nova senha + confirmar senha.
- Ao enviar: valida `novaSenha === confirmar` (senão `toast.warning`); chama
  `linkPassword(novaSenha)`; sucesso → `toast.success('Senha criada! Agora você
  também pode entrar com e-mail e senha.')`; erro → `toast.error(mapAuthError(err.code))`.
- Após vincular, a seção some (o provedor de senha passa a existir).

**Testes (frontend):** `auth.js` com SDK mockado — `hasPasswordProvider` true/false
conforme `providerData`; `linkPassword` chama `linkWithCredential` com a credencial
correta. `mapAuthError` para os novos códigos.

---

## Fora de escopo (ficam para fases seguintes)

- SEC-05 (auditoria de limites de tamanho — quase pronto), CHAT-03 (ConfirmDialog),
  FE-01/03/04/05/06/07/08/09/10/11 e demais itens do roadmap.
- Reautenticação automática no AUTH-01 (caso `requires-recent-login`): tratamos
  com mensagem pedindo novo login, sem fluxo de reauth silencioso — YAGNI para o MVP.
