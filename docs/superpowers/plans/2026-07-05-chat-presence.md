# Presença online + "visto por último" (CHAT-02 / PROD-01) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar no header do Chat se o peer está "online" ou "visto por último há X", usando presença nativa do Firebase Realtime Database (`onDisconnect`).

**Architecture:** Cada cliente publica a própria presença no RTDB (`status/{uid} = { state, lastChanged }`) via `.info/connected` + `onDisconnect` (o servidor Firebase escreve "offline" mesmo em crash/queda). Um `<PresenceManager />` no `AppShell` aciona a publicação app-wide; a página de Chat assina `status/{peerId}` e renderiza o estado. A formatação de "visto por último" é um util puro e testável. Uma regra nova no RTDB libera leitura autenticada e escrita só do próprio uid.

**Tech Stack:** React 19 + Vite, Firebase Web SDK (`firebase/database`: `ref`, `onValue`, `onDisconnect`, `set`, `serverTimestamp`), Vitest + Testing Library.

## Global Constraints

- Chat vive no **RTDB**; nó de presença: `status/{uid} = { state: 'online' | 'offline', lastChanged: <serverTimestamp ms> }`.
- **Mecanismo = RTDB `onDisconnect`** (não Socket.io). Ao conectar: PRIMEIRO registra `onDisconnect(...).set({state:'offline', lastChanged})`, DEPOIS `set(...{state:'online', lastChanged})`.
- **Resiliência:** se `isFirebaseReady()` for falso ou `rtdb` inexistente, os hooks **no-opam** (nunca derrubam a tela). Mesmo padrão do `useFirebaseChat`.
- Fonte do uid próprio: `firebaseUser?.uid` do `AuthContext` (`useAuth()`), passado a `usePresence(uid)` pelo `<PresenceManager />`.
- Escopo: **só o header do Chat**. Sem lista de conversas, sem toggle de privacidade, sem estado "entregue".
- `formatLastSeen(ms, nowMs = Date.now())` (pt-BR): `''` p/ vazio · `'agora mesmo'` (<60s) · `'há N min'` (<1h, N mínimo 1) · `'hoje às HH:MM'` · `'ontem às HH:MM'` · `'DD/MM às HH:MM'`.
- Header: `online` → dot verde + "online"; senão `lastChanged` → "visto por último " + `formatLastSeen`; senão → fallback pro subtítulo de papel/approach atual.
- A regra nova em `backend/firebase.rules.json` precisa ser republicada no cutover.
- Sem dependência npm nova. Texto pt-BR. Verificação: frontend `vitest` verde, `npm run build` OK, delta de lint 0.

---

### Task 1: Regra de segurança do nó `status` no RTDB

**Files:**
- Modify: `backend/firebase.rules.json`

**Interfaces:**
- Produces: nó `status/{uid}` legível por qualquer autenticado, gravável só pelo próprio uid.

- [ ] **Step 1: Adicionar o nó `status` às regras**

Em `backend/firebase.rules.json`, dentro do objeto `"rules"` (no mesmo nível de `"chats"` e `"userChats"`), adicionar a chave `"status"`:

```json
    "status": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid == $uid"
      }
    }
```

(Atenção à vírgula: como `userChats` é hoje a última chave dentro de `rules`, adicione uma vírgula após o fecho de `userChats` e então o bloco `status`.)

- [ ] **Step 2: Validar que a estrutura do arquivo continua válida**

> Nota: `backend/firebase.rules.json` **não** é JSON estrito — a regra
> `.write` de `chats/$chatId/messages/$messageId` (pré-existente) é uma string
> com quebras de linha literais, que `JSON.parse` rejeita. Para validar só a
> estrutura (chaves/vírgulas/aspas balanceadas), colapse as quebras de linha
> antes do parse:

Run: `cd backend && node -e "const s=require('fs').readFileSync('firebase.rules.json','utf8').replace(/\s*\n\s*/g,' '); const r=JSON.parse(s); console.log('rules OK; status node:', !!r.rules.status)"`
Expected: imprime `rules OK; status node: true`

- [ ] **Step 3: Commit**

```bash
git add backend/firebase.rules.json
git commit -m "feat(chat): regra RTDB do nó status (presença) — read auth, write own [CHAT-02]"
```

---

### Task 2: Util puro `formatLastSeen`

**Files:**
- Create: `frontend/src/utils/lastSeen.js`
- Create: `frontend/src/utils/lastSeen.test.js`

**Interfaces:**
- Produces: `formatLastSeen(ms, nowMs = Date.now()) => string` (pt-BR).

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `frontend/src/utils/lastSeen.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { formatLastSeen } from './lastSeen'

// Referência fixa: quarta-feira, 2026-07-15 14:30:00 (horário local do runner).
const NOW = new Date(2026, 6, 15, 14, 30, 0, 0).getTime()

describe('formatLastSeen', () => {
  it('vazio/inválido → string vazia', () => {
    expect(formatLastSeen(null, NOW)).toBe('')
    expect(formatLastSeen(undefined, NOW)).toBe('')
    expect(formatLastSeen(NaN, NOW)).toBe('')
  })
  it('menos de 1 min → "agora mesmo"', () => {
    expect(formatLastSeen(NOW - 30_000, NOW)).toBe('agora mesmo')
    expect(formatLastSeen(NOW - 59_000, NOW)).toBe('agora mesmo')
  })
  it('menos de 1h → "há N min" (mínimo 1)', () => {
    expect(formatLastSeen(NOW - 60_000, NOW)).toBe('há 1 min')
    expect(formatLastSeen(NOW - 5 * 60_000, NOW)).toBe('há 5 min')
    expect(formatLastSeen(NOW - 59 * 60_000, NOW)).toBe('há 59 min')
  })
  it('mesmo dia (>1h atrás) → "hoje às HH:MM"', () => {
    const dozeE05 = new Date(2026, 6, 15, 12, 5, 0, 0).getTime()
    expect(formatLastSeen(dozeE05, NOW)).toBe('hoje às 12:05')
  })
  it('dia anterior → "ontem às HH:MM"', () => {
    const ontem2245 = new Date(2026, 6, 14, 22, 45, 0, 0).getTime()
    expect(formatLastSeen(ontem2245, NOW)).toBe('ontem às 22:45')
  })
  it('mais antigo → "DD/MM às HH:MM"', () => {
    const antigo = new Date(2026, 6, 10, 9, 7, 0, 0).getTime()
    expect(formatLastSeen(antigo, NOW)).toBe('10/07 às 09:07')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/utils/lastSeen.test.js`
Expected: FAIL (`Failed to resolve import "./lastSeen"`)

- [ ] **Step 3: Implementar o util**

Criar `frontend/src/utils/lastSeen.js`:

```js
/** Zero à esquerda em números de 1 dígito. */
function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Verdadeiro se as duas datas caem no mesmo dia civil (local). */
function sameCivilDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * "Visto por último" em pt-BR, relativo a `nowMs`.
 * '' | 'agora mesmo' | 'há N min' | 'hoje às HH:MM' | 'ontem às HH:MM' | 'DD/MM às HH:MM'
 */
export function formatLastSeen(ms, nowMs = Date.now()) {
  if (ms == null || Number.isNaN(Number(ms))) return ''
  const diff = nowMs - ms
  if (diff < 60_000) return 'agora mesmo'
  if (diff < 3_600_000) return `há ${Math.max(1, Math.floor(diff / 60_000))} min`

  const then = new Date(ms)
  const now = new Date(nowMs)
  const hhmm = `${pad2(then.getHours())}:${pad2(then.getMinutes())}`

  if (sameCivilDay(then, now)) return `hoje às ${hhmm}`

  const yesterday = new Date(nowMs)
  yesterday.setDate(now.getDate() - 1)
  if (sameCivilDay(then, yesterday)) return `ontem às ${hhmm}`

  return `${pad2(then.getDate())}/${pad2(then.getMonth() + 1)} às ${hhmm}`
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/utils/lastSeen.test.js`
Expected: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/lastSeen.js frontend/src/utils/lastSeen.test.js
git commit -m "feat(chat): util formatLastSeen (pt-BR) [CHAT-02]"
```

---

### Task 3: Hooks `usePresence` / `usePeerPresence`

**Files:**
- Create: `frontend/src/hooks/usePresence.js`

**Interfaces:**
- Consumes: `rtdb`, `isFirebaseReady` de `../services/firebase`.
- Produces:
  - `usePresence(uid)` — efeito app-wide; sem retorno. Publica a própria presença enquanto `uid` for válido e o Firebase estiver disponível.
  - `usePeerPresence(peerId) => { state: 'online'|'offline', lastChanged: number } | null` — assina a presença do peer.

> Teste: estes hooks dependem de `.info/connected`, `onDisconnect` e `onValue` do Firebase e não são unit-testáveis de forma limpa (não há harness de Firebase no projeto — igual ao `useFirebaseChat`, que não tem teste). Verificação = a suíte continua verde + `npm run build` resolve os imports do `firebase/database`. A lógica testável (`formatLastSeen`) já está na Task 2.

- [ ] **Step 1: Implementar os hooks**

Criar `frontend/src/hooks/usePresence.js`:

```js
import { useEffect, useState } from 'react'
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database'
import { rtdb, isFirebaseReady } from '../services/firebase'

/**
 * Publica a presença do próprio usuário no RTDB (padrão canônico do Firebase).
 * Enquanto conectado, mantém status/{uid} = { state:'online', lastChanged } e
 * registra um onDisconnect que grava 'offline' quando a conexão cair (fechar
 * aba, crash, queda de rede) — o servidor do Firebase dispara isso sozinho.
 *
 * No-opa se não houver uid ou o Firebase não estiver disponível (resiliência:
 * a presença simplesmente não aparece, sem derrubar a tela).
 */
export function usePresence(uid) {
  useEffect(() => {
    if (!uid || !isFirebaseReady() || !rtdb) return undefined

    const statusRef = ref(rtdb, `status/${uid}`)
    const connectedRef = ref(rtdb, '.info/connected')

    const unsub = onValue(connectedRef, (snap) => {
      if (snap.val() !== true) return
      // Registra o "offline ao desconectar" ANTES de marcar online, pra garantir
      // que o servidor tenha o handler mesmo se a conexão cair logo em seguida.
      onDisconnect(statusRef)
        .set({ state: 'offline', lastChanged: serverTimestamp() })
        .then(() => set(statusRef, { state: 'online', lastChanged: serverTimestamp() }))
        .catch((err) => console.error('[presence] falha ao publicar presença:', err))
    })

    return () => unsub()
  }, [uid])
}

/**
 * Assina a presença de um peer. Devolve { state, lastChanged } ou null
 * (sem peer / Firebase indisponível / ainda sem dado).
 */
export function usePeerPresence(peerId) {
  const [presence, setPresence] = useState(null)

  useEffect(() => {
    if (!peerId || !isFirebaseReady() || !rtdb) {
      setPresence(null)
      return undefined
    }
    const statusRef = ref(rtdb, `status/${peerId}`)
    const unsub = onValue(statusRef, (snap) => {
      setPresence(snap.exists() ? snap.val() : null)
    })
    return () => unsub()
  }, [peerId])

  return presence
}
```

- [ ] **Step 2: Rodar a suíte completa do frontend (sem regressão)**

Run: `cd frontend && npx vitest run`
Expected: PASS (nenhum teste depende dos hooks ainda)

- [ ] **Step 3: Build (garante que os imports do `firebase/database` resolvem)**

Run: `cd frontend && npm run build`
Expected: build sem erros

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/usePresence.js
git commit -m "feat(chat): hooks usePresence/usePeerPresence (RTDB onDisconnect) [CHAT-02]"
```

---

### Task 4: `<PresenceManager />` no AppShell

**Files:**
- Modify: `frontend/src/AppShell.jsx`

**Interfaces:**
- Consumes: `usePresence` (Task 3); `useAuth` de `./context/AuthContext` (expõe `firebaseUser`).
- Produces: publicação de presença app-wide enquanto houver usuário logado.

> Teste: mudança de composição que aciona um hook dependente de Firebase; sem teste unitário próprio (o AppShell não tem teste). Verificação = suíte verde + build OK.

- [ ] **Step 1: Importar `usePresence` e o AuthContext**

Em `frontend/src/AppShell.jsx`, os imports de `useAuth` (linha 7) e `SocketProvider` já existem. Adicionar o import do hook:

```js
import { usePresence } from './hooks/usePresence'
```

- [ ] **Step 2: Criar o componente `PresenceManager`**

Em `frontend/src/AppShell.jsx`, adicionar (antes de `export default function AppShell()`):

```js
/**
 * Publica a presença do usuário logado enquanto o app estiver aberto.
 * Renderiza nada — só aciona o efeito app-wide. Fica dentro do SocketProvider,
 * junto das rotas autenticadas.
 */
function PresenceManager() {
  const { firebaseUser } = useAuth()
  usePresence(firebaseUser?.uid)
  return null
}
```

- [ ] **Step 3: Montar `<PresenceManager />` dentro do `SocketProvider`**

No JSX de `AppShell`, logo após `<Toaster ... />` (dentro de `<SocketProvider>`):

```jsx
    <SocketProvider>
      <Toaster position="top-right" richColors />
      <PresenceManager />
      {showMenu && <Menu />}
```

- [ ] **Step 4: Rodar a suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS (sem regressão)

- [ ] **Step 5: Build**

Run: `cd frontend && npm run build`
Expected: build sem erros

- [ ] **Step 6: Commit**

```bash
git add frontend/src/AppShell.jsx
git commit -m "feat(chat): PresenceManager publica presença app-wide no AppShell [CHAT-02]"
```

---

### Task 5: Header do Chat exibe presença

**Files:**
- Modify: `frontend/src/pages/Chat/index.jsx`
- Create: `frontend/src/pages/Chat/ChatPresence.test.jsx`

**Interfaces:**
- Consumes: `usePeerPresence` (Task 3), `formatLastSeen` (Task 2).

> Este branch (`chat-presence`) saiu da `main`, então a página de Chat aqui é a versão SEM as features de apagar/arquivar (que estão em outra branch/PR). Trabalhe sobre o arquivo como ele está nesta branch.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `frontend/src/pages/Chat/ChatPresence.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// navigateMock estável (hoisted) — NÃO use `useNavigate: () => vi.fn()`: uma
// função nova a cada render re-dispara o effect de carga do Chat (que depende de
// `navigate`) num loop infinito e trava o Vitest. Mesmo padrão de Cadastro/Login.test.
const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return { ...actual, useNavigate: () => navigateMock, useParams: () => ({ userId: 'bob' }) }
})
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn().mockResolvedValue({ data: {} }), delete: vi.fn() } }))
vi.mock('../../hooks/useFirebaseChat', () => ({
  useFirebaseChat: () => ({ chatId: 'ana_bob', ready: true, realtimeActive: true, sendMessage: vi.fn(), markRead: vi.fn().mockResolvedValue() }),
}))
vi.mock('../../hooks/useSocket', () => ({
  useSocket: () => ({ socket: { emit: vi.fn() }, emitTyping: vi.fn(), emitRead: vi.fn(), isConnected: true }),
}))
vi.mock('../../hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({ isRecording: false, startRecording: vi.fn(), stopRecording: vi.fn(), audioBlob: null, clearAudio: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))

// Controla o retorno de usePeerPresence por teste.
const presenceMock = vi.fn()
vi.mock('../../hooks/usePresence', () => ({ usePeerPresence: () => presenceMock() }))

import Chat from './index'
import api from '../../services/api'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('meuId', 'ana')
  localStorage.setItem('meuRole', 'FAMILIAR')
  api.get.mockImplementation((url) => {
    if (url.startsWith('/messages/history/')) {
      return Promise.resolve({ data: { peer: { id: 'bob', name: 'Bob', role: 'CUIDADOR', approach: 'Home care' }, messages: [] } })
    }
    return Promise.resolve({ data: {} })
  })
})

function renderChat() {
  return render(<MemoryRouter><Chat /></MemoryRouter>)
}

describe('Chat — presença no header', () => {
  it('mostra "online" quando o peer está online', async () => {
    presenceMock.mockReturnValue({ state: 'online', lastChanged: Date.now() })
    renderChat()
    expect(await screen.findByText('online')).toBeInTheDocument()
  })

  it('mostra "visto por último" quando offline', async () => {
    presenceMock.mockReturnValue({ state: 'offline', lastChanged: Date.now() - 5 * 60_000 })
    renderChat()
    expect(await screen.findByText(/visto por último há 5 min/i)).toBeInTheDocument()
  })

  it('cai no subtítulo de papel/approach quando não há presença', async () => {
    presenceMock.mockReturnValue(null)
    renderChat()
    expect(await screen.findByText('Home care')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/pages/Chat/ChatPresence.test.jsx`
Expected: FAIL (o Chat ainda não usa `usePeerPresence`; "online"/"visto por último" não aparecem)

- [ ] **Step 3: Importar o hook e o util na página**

Em `frontend/src/pages/Chat/index.jsx`, adicionar aos imports:

```js
import { usePeerPresence } from '../../hooks/usePresence'
import { formatLastSeen } from '../../utils/lastSeen'
```

- [ ] **Step 4: Assinar a presença do peer**

No corpo do componente `Chat`, junto aos outros hooks (perto de onde `peerId` já está disponível, ex.: logo após `const meId = ...`):

```js
  const peerPresence = usePeerPresence(peerId)
```

- [ ] **Step 5: Renderizar a presença no header**

No header, o subtítulo atual é (linhas ~322-324):

```jsx
          <p className="text-xs text-white/70 truncate">
            {peer?.approach || (peerRoleNorm === 'CUIDADOR' ? 'Cuidador' : peerRoleNorm === 'FAMILIAR' ? 'Familiar' : '')}
          </p>
```

Substituir por uma versão sensível à presença:

```jsx
          {peerPresence?.state === 'online' ? (
            <p className="text-xs text-green-300 truncate flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400" aria-hidden />
              online
            </p>
          ) : peerPresence?.lastChanged ? (
            <p className="text-xs text-white/70 truncate">
              visto por último {formatLastSeen(peerPresence.lastChanged)}
            </p>
          ) : (
            <p className="text-xs text-white/70 truncate">
              {peer?.approach || (peerRoleNorm === 'CUIDADOR' ? 'Cuidador' : peerRoleNorm === 'FAMILIAR' ? 'Familiar' : '')}
            </p>
          )}
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/pages/Chat/ChatPresence.test.jsx`
Expected: PASS (3 testes)

- [ ] **Step 7: Rodar a suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS (sem regressão)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/Chat/index.jsx frontend/src/pages/Chat/ChatPresence.test.jsx
git commit -m "feat(chat): header mostra online / visto por último [CHAT-02/PROD-01]"
```

---

### Task 6: Verificação final da branch

**Files:** nenhum — só validação.

- [ ] **Step 1: Suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS, 100%

- [ ] **Step 2: Build do frontend**

Run: `cd frontend && npm run build`
Expected: build sem erros

- [ ] **Step 3: Suíte do backend (garante que a mudança de regra não quebrou nada)**

Run: `cd backend && node --test`
Expected: PASS (a regra é um JSON de dados; nenhum teste de backend depende dela, mas confirma que nada regrediu)

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: sem novos erros/warnings introduzidos por este bloco (mesma contagem da baseline da main)

- [ ] **Step 5: Atualizar o roadmap**

Em `docs/ROADMAP-melhorias-fabio.md`, na "Fase 4", marcar como concluída a linha "PROD-01 + visto por último (CHAT-02)". Exemplo de nota (seguindo o estilo do doc):

```markdown
> ✅ **Concluído no branch `chat-presence` (2026-07-05):** presença online + "visto por último" no header do Chat (PROD-01 + parte do CHAT-02), via RTDB `onDisconnect`. Restam do CHAT-02: emojis e imagens+arquivos.
```

```bash
git add docs/ROADMAP-melhorias-fabio.md
git commit -m "docs(roadmap): marca presença/visto por último como concluído (chat-presence)"
```

---

## Notas de escopo / decisões herdadas do spec

- **Multi-aba:** `onDisconnect` é por-conexão — fechar uma de duas abas pode marcar offline mesmo com a outra aberta. Aceito no MVP; fix robusto (chaves por-conexão) fora de escopo.
- **Skew de relógio:** `lastChanged` é timestamp do servidor Firebase; a formatação compara com `Date.now()` do cliente. Irrelevante para "há N min".
- **RTDB indisponível:** hooks no-opam; header mostra o subtítulo de papel.
- **Regra nova no RTDB** precisa ser republicada no cutover do Firebase.
- **Fora de escopo:** presença na lista de conversas; toggle de privacidade; estado "entregue"; fix multi-aba; os outros sub-projetos do CHAT-02 (emojis; imagens+arquivos).
