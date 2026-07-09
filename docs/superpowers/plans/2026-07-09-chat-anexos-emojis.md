# Emojis + Imagens/Arquivos no composer (CHAT-02 restante) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir enviar/receber emojis (seletor próprio no composer) e anexos de imagem/PDF (inline) no chat, reusando o pipeline de upload em disco do áudio.

**Architecture:** Backend ganha um pipeline de anexo separado do áudio (multer preservando extensão, whitelist imagem/PDF, 5MB) que grava campos `attachmentUrl/attachmentType/attachmentName` na mensagem do RTDB via `createMessage`, expostos por `POST /messages/attachment`. Frontend ganha um `EmojiPicker` próprio (sem dep) que insere no textarea, e o composer do Chat ganha um botão de anexo com preview antes de enviar; o render das mensagens ganha ramos de imagem (`<img>` inline) e PDF (card com link). A validação de tipo é centralizada num util puro testável.

**Tech Stack:** Node.js + Express + multer + Firebase RTDB (admin SDK), `node --test` (backend); React 19 + Vite, Vitest + Testing Library (frontend).

## Global Constraints

- Chat no **RTDB**. Mensagem ganha campos planos: `attachmentUrl` (`/uploads/{arquivo}`), `attachmentType` (`'image' | 'pdf'`), `attachmentName` (nome original, exibição). O `audioUrl` legado fica intacto.
- **Storage = disco local via multer** (reusa `backend/uploads/`, servido por `express.static('/uploads')`). Sem Firebase Storage.
- **Whitelist de anexo:** `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`. Limite **5MB** (`5 * 1024 * 1024`), 1 arquivo.
- **Emojis:** seletor próprio (~48 emojis num grid), **sem dependência npm nova**, sem busca. Insere no fim do textarea.
- `attachmentTypeFor(mimetype)` → `'image' | 'pdf' | null` é o único ponto de decisão de tipo (backend usa no controller).
- Um anexo por mensagem, sem legenda de texto junto. `/uploads` público com nome-hash (aceito no MVP, igual ao áudio).
- Texto pt-BR. Verificação: backend `node --test` verde, frontend `vitest` verde, `npm run build` OK, delta de lint 0.

---

### Task 1: Backend — util puro `attachmentTypeFor` + constantes

**Files:**
- Create: `backend/src/utils/attachment.js`
- Create: `backend/tests/attachment.test.js`

**Interfaces:**
- Produces:
  - `attachmentTypeFor(mimetype) => 'image' | 'pdf' | null`
  - `ATTACHMENT_MIMES` (array de strings) e `MAX_ATTACHMENT_BYTES` (número) — usados pelo multer config na Task 2.

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `backend/tests/attachment.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { attachmentTypeFor, ATTACHMENT_MIMES, MAX_ATTACHMENT_BYTES } from '../src/utils/attachment.js'

test('attachmentTypeFor: imagens → "image"', () => {
  assert.equal(attachmentTypeFor('image/jpeg'), 'image')
  assert.equal(attachmentTypeFor('image/png'), 'image')
  assert.equal(attachmentTypeFor('image/webp'), 'image')
  assert.equal(attachmentTypeFor('image/gif'), 'image')
})

test('attachmentTypeFor: pdf → "pdf"', () => {
  assert.equal(attachmentTypeFor('application/pdf'), 'pdf')
})

test('attachmentTypeFor: tipos fora da whitelist → null', () => {
  assert.equal(attachmentTypeFor('image/svg+xml'), null)
  assert.equal(attachmentTypeFor('application/zip'), null)
  assert.equal(attachmentTypeFor('text/html'), null)
  assert.equal(attachmentTypeFor(''), null)
  assert.equal(attachmentTypeFor(undefined), null)
})

test('constantes: MIMES cobrem imagem+pdf; limite é 5MB', () => {
  assert.ok(ATTACHMENT_MIMES.includes('image/jpeg'))
  assert.ok(ATTACHMENT_MIMES.includes('application/pdf'))
  assert.equal(MAX_ATTACHMENT_BYTES, 5 * 1024 * 1024)
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test tests/attachment.test.js`
Expected: FAIL (`Cannot find module '../src/utils/attachment.js'`)

- [ ] **Step 3: Implementar o util**

Criar `backend/src/utils/attachment.js`:

```js
// Tipos de anexo de chat aceitos (imagens + PDF). Fonte única da whitelist,
// usada tanto pelo fileFilter do multer quanto pela derivação de tipo no controller.
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const ATTACHMENT_MIMES = [...IMAGE_MIMES, 'application/pdf']
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024 // 5MB

const IMAGE_SET = new Set(IMAGE_MIMES)

/** Classifica o mimetype num tipo de anexo, ou null se fora da whitelist. */
export function attachmentTypeFor(mimetype) {
  if (IMAGE_SET.has(mimetype)) return 'image'
  if (mimetype === 'application/pdf') return 'pdf'
  return null
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test tests/attachment.test.js`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/attachment.js backend/tests/attachment.test.js
git commit -m "feat(chat): util attachmentTypeFor + whitelist de anexos [CHAT-02]"
```

---

### Task 2: Backend — upload de anexo + createMessage + endpoint

**Files:**
- Create: `backend/src/config/uploadAttachment.js`
- Modify: `backend/src/services/chatRealtimeService.js`
- Modify: `backend/src/controllers/messageController.js`
- Modify: `backend/src/routes/messageRoutes.js`

**Interfaces:**
- Consumes: `attachmentTypeFor`, `ATTACHMENT_MIMES`, `MAX_ATTACHMENT_BYTES` (Task 1).
- Produces:
  - `createMessage({ ..., attachmentUrl = null, attachmentType = null, attachmentName = null })` — grava os campos de anexo no nó da mensagem.
  - Handler `sendAttachmentMessage(req, res)` → `POST /messages/attachment` (`201 { message }`).

> Cobertura: o projeto não testa controllers (padrão do projeto). O núcleo de decisão (`attachmentTypeFor`) já é testado na Task 1. Verificação desta task = suíte backend verde + checagem de import de rota (ambas no fim).

- [ ] **Step 1: Criar a config de upload de anexo**

Criar `backend/src/config/uploadAttachment.js`:

```js
import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { ATTACHMENT_MIMES, MAX_ATTACHMENT_BYTES } from '../utils/attachment.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ALLOWED = new Set(ATTACHMENT_MIMES)

// Preserva a extensão original (o upload de áudio força .webm, por isso não dá
// pra reusar). O nome no disco é gerado pelo servidor (timestamp + hash), nunca
// vem do nome do usuário → sem path traversal.
const storage = multer.diskStorage({
  destination: path.resolve(__dirname, '..', '..', 'uploads'),
  filename: (request, file, callback) => {
    const hash = crypto.randomBytes(6).toString('hex')
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 10)
    callback(null, `${Date.now()}-${hash}${ext}`)
  },
})

const uploadAttachment = multer({
  storage,
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
  fileFilter: (request, file, callback) => {
    if (ALLOWED.has(file.mimetype)) return callback(null, true)
    const err = new Error('Tipo de arquivo não permitido. Envie imagem (JPG/PNG/WEBP/GIF) ou PDF.')
    err.status = 422
    return callback(err)
  },
})

export default uploadAttachment
```

- [ ] **Step 2: Estender `createMessage` para aceitar anexo**

Em `backend/src/services/chatRealtimeService.js`, a função `createMessage` hoje é:

```js
export async function createMessage({ senderId, receiverId, content, audioUrl = null }) {
  const chatId = chatIdFor(senderId, receiverId)
  const ref = rtdb.ref(`chats/${chatId}/messages`).push()
  const createdAt = Date.now()

  const message = {
    id: ref.key,
    senderId,
    receiverId,
    content,
    audioUrl,
    read: false,
    createdAt,
  }
  // ... resto ...
```

Substituir a assinatura e o objeto `message` por (mantendo o resto do corpo intacto):

```js
export async function createMessage({
  senderId, receiverId, content, audioUrl = null,
  attachmentUrl = null, attachmentType = null, attachmentName = null,
}) {
  const chatId = chatIdFor(senderId, receiverId)
  const ref = rtdb.ref(`chats/${chatId}/messages`).push()
  const createdAt = Date.now()

  const message = {
    id: ref.key,
    senderId,
    receiverId,
    content,
    audioUrl,
    attachmentUrl,
    attachmentType,
    attachmentName,
    read: false,
    createdAt,
  }
  // ... resto do corpo permanece igual (ref.set, ensureMembership, touchUserChats, logger, return) ...
```

- [ ] **Step 3: Adicionar o handler no controller**

Em `backend/src/controllers/messageController.js`, adicionar `attachmentTypeFor` ao import de utils (no topo) e o handler.

Import (adicionar após os imports existentes do topo):

```js
import { attachmentTypeFor } from '../utils/attachment.js'
```

Handler (adicionar perto de `sendAudioMessage`):

```js
/** POST /messages/attachment — envia imagem/PDF (multer intercepta o campo "file"). */
export const sendAttachmentMessage = async (req, res) => {
    try {
        const { receiverId } = req.body
        const senderId = req.userId
        const file = req.file

        if (!file) return res.status(400).json({ msg: "Nenhum arquivo enviado" })
        if (!receiverId) return res.status(422).json({ msg: "Destinatário é obrigatório" })

        const attachmentType = attachmentTypeFor(file.mimetype)
        if (!attachmentType) return res.status(422).json({ msg: "Tipo de arquivo não permitido." })

        const message = await createMessage({
            senderId,
            receiverId,
            content: "",
            attachmentUrl: `/uploads/${file.filename}`,
            attachmentType,
            attachmentName: String(file.originalname || "").slice(0, 120),
        })

        res.status(201).json({ message })
    } catch (e) {
        messageLogger.error('message:attachment_upload_failed', { error: e.message, stack: e.stack, userId: req.userId, endpoint: req.originalUrl })
        res.status(500).json({ msg: "Erro ao enviar anexo" })
    }
}
```

- [ ] **Step 4: Adicionar a rota**

Em `backend/src/routes/messageRoutes.js`:

Importar a config e o handler. O arquivo já importa `multer` e tem um wrapper `uploadAudio`. Adicionar o import da config de anexo (junto ao `import upload from '../config/upload.js'`):

```js
import uploadAttachment from '../config/uploadAttachment.js';
```

Adicionar `sendAttachmentMessage` ao import do controller (junto de `sendAudioMessage`).

Adicionar um wrapper de erro (espelha `uploadAudio`, perto dele):

```js
function uploadAttachmentFile(req, res, next) {
  uploadAttachment.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const tooLarge = err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        msg: tooLarge ? 'Arquivo excede o tamanho máximo (5MB).' : 'Falha no upload do arquivo.',
      });
    }
    return res.status(err.status ?? 422).json({ msg: err.message ?? 'Arquivo inválido.' });
  });
}
```

Registrar a rota (junto das outras de mensagem, antes de `export default router`):

```js
router.post('/messages/attachment', checkToken, uploadAttachmentFile, sendAttachmentMessage);
```

- [ ] **Step 5: Rodar a suíte completa do backend**

Run: `cd backend && node --test`
Expected: PASS (sem regressão)

- [ ] **Step 6: Sanidade — rotas resolvem sem erro de import**

Run: `cd backend && node -e "import('./src/routes/messageRoutes.js').then(() => console.log('routes OK')).catch((e) => { console.error(e); process.exit(1) })"`
Expected: imprime `routes OK`

- [ ] **Step 7: Commit**

```bash
git add backend/src/config/uploadAttachment.js backend/src/services/chatRealtimeService.js backend/src/controllers/messageController.js backend/src/routes/messageRoutes.js
git commit -m "feat(chat): endpoint POST /messages/attachment (imagem/PDF em disco) [CHAT-02]"
```

---

### Task 3: Frontend — componente `EmojiPicker`

**Files:**
- Create: `frontend/src/components/EmojiPicker.jsx`
- Create: `frontend/src/components/EmojiPicker.test.jsx`

**Interfaces:**
- Produces: `EmojiPicker({ onSelect })` (default export) — botão 😀 que abre um popover com grid de ~48 emojis; clicar chama `onSelect(emoji)` e fecha.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `frontend/src/components/EmojiPicker.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmojiPicker from './EmojiPicker'

describe('EmojiPicker', () => {
  it('abre o grid ao clicar e emite o emoji escolhido', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<EmojiPicker onSelect={onSelect} />)

    // O grid começa fechado.
    expect(screen.queryByRole('button', { name: '😀' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /emojis/i }))
    const emojiBtn = await screen.findByRole('button', { name: '😀' })
    await user.click(emojiBtn)

    expect(onSelect).toHaveBeenCalledWith('😀')
    // Fecha após escolher.
    expect(screen.queryByRole('button', { name: '😀' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/components/EmojiPicker.test.jsx`
Expected: FAIL (`Failed to resolve import "./EmojiPicker"`)

- [ ] **Step 3: Implementar o componente**

Criar `frontend/src/components/EmojiPicker.jsx`:

```jsx
import { useState, useRef, useEffect } from 'react'
import EmojiEmotions from '@mui/icons-material/EmojiEmotions'

// ~48 emojis comuns de conversa (inclui alguns do contexto de cuidado).
const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🙂',
  '🙃', '😉', '😊', '😍', '😘', '🤗', '🤔', '😐',
  '😴', '😷', '🤒', '👍', '👎', '👏', '🙏', '💪',
  '👋', '🎉', '❤️', '🧡', '💛', '💚', '💙', '💜',
  '🔥', '✨', '⭐', '✅', '❌', '⏰', '📌', '📎',
  '🩺', '💊', '🏥', '🚑', '👨‍⚕️', '👩‍⚕️', '😢', '🙌',
]

/** Seletor de emoji próprio (sem dependência). onSelect(emoji) recebe o escolhido. */
export default function EmojiPicker({ onSelect }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-gray-100 text-virla-roxo flex items-center justify-center hover:bg-gray-200 transition-all"
        aria-label="Emojis"
      >
        <EmojiEmotions sx={{ fontSize: 24 }} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-14 left-0 z-50 w-64 max-h-48 overflow-y-auto grid grid-cols-8 gap-1 p-2 bg-white rounded-xl border border-virla-roxo/15 shadow-lg"
        >
          {EMOJIS.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              onClick={() => { onSelect(emoji); setOpen(false) }}
              className="text-xl leading-none p-1 rounded hover:bg-virla-roxo/10"
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/components/EmojiPicker.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/EmojiPicker.jsx frontend/src/components/EmojiPicker.test.jsx
git commit -m "feat(chat): componente EmojiPicker (seletor próprio, sem dep) [CHAT-02]"
```

---

### Task 4: Frontend — emoji no composer do Chat

**Files:**
- Modify: `frontend/src/pages/Chat/index.jsx`
- Create: `frontend/src/pages/Chat/ChatComposer.test.jsx`

**Interfaces:**
- Consumes: `EmojiPicker` (Task 3).

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `frontend/src/pages/Chat/ChatComposer.test.jsx` (harness de mocks igual ao `Chat.test.jsx` existente — `navigateMock` estável evita loop de effect):

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

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
vi.mock('../../hooks/usePresence', () => ({ usePeerPresence: () => null }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))

import Chat from './index'
import api from '../../services/api'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('meuId', 'ana')
  localStorage.setItem('meuRole', 'FAMILIAR')
  // jsdom não implementa URL.createObjectURL (usado no preview de imagem do anexo).
  URL.createObjectURL = vi.fn(() => 'blob:mock')
  api.get.mockImplementation((url) => {
    if (url.startsWith('/messages/history/')) {
      return Promise.resolve({ data: { peer: { id: 'bob', name: 'Bob', role: 'CUIDADOR' }, messages: [] } })
    }
    return Promise.resolve({ data: {} })
  })
})

function renderChat() {
  return render(<MemoryRouter><Chat /></MemoryRouter>)
}

describe('Chat — emojis no composer', () => {
  it('insere o emoji escolhido no textarea', async () => {
    const user = userEvent.setup()
    renderChat()
    const textarea = await screen.findByPlaceholderText('Digite uma mensagem…')
    await user.type(textarea, 'oi ')

    await user.click(screen.getByRole('button', { name: /emojis/i }))
    await user.click(await screen.findByRole('button', { name: '😀' }))

    expect(textarea).toHaveValue('oi 😀')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/pages/Chat/ChatComposer.test.jsx`
Expected: FAIL (não há botão "Emojis" ainda)

- [ ] **Step 3: Importar o EmojiPicker no Chat**

Em `frontend/src/pages/Chat/index.jsx`, adicionar aos imports:

```js
import EmojiPicker from '../../components/EmojiPicker'
```

- [ ] **Step 4: Montar o EmojiPicker no composer**

No `<form>` do composer, a estrutura interna é `<div className="max-w-3xl mx-auto flex gap-2 items-end">` com o bloco condicional (isRecording / audioBlob / textarea) seguido do botão mic/enviar. Adicionar o `EmojiPicker` como primeiro filho desse `div` (antes do bloco condicional), visível só quando está no modo de digitação (não gravando / sem preview de áudio):

```jsx
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          {!isRecording && !audioBlob && (
            <EmojiPicker onSelect={(emoji) => setInput((v) => v + emoji)} />
          )}
```

(o restante do conteúdo do `div` permanece igual.)

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/pages/Chat/ChatComposer.test.jsx`
Expected: PASS

- [ ] **Step 6: Suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS (sem regressão)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Chat/index.jsx frontend/src/pages/Chat/ChatComposer.test.jsx
git commit -m "feat(chat): botão de emojis no composer insere no textarea [CHAT-02]"
```

---

### Task 5: Frontend — anexo (imagem/PDF) no composer + render

**Files:**
- Modify: `frontend/src/pages/Chat/index.jsx`
- Modify: `frontend/src/pages/Chat/ChatComposer.test.jsx`

**Interfaces:**
- Consumes: `api` (`services/api`), `ATTACHMENT` whitelist (inline no Chat).

- [ ] **Step 1: Escrever os testes (falhando)**

Adicionar a `frontend/src/pages/Chat/ChatComposer.test.jsx`:

```jsx
describe('Chat — anexo (imagem/PDF)', () => {
  it('mostra preview ao escolher imagem e envia via POST /messages/attachment', async () => {
    api.post.mockResolvedValue({ data: { message: { id: 'a1', senderId: 'ana', receiverId: 'bob', attachmentType: 'image', attachmentUrl: '/uploads/x.png', attachmentName: 'x.png' } } })
    const user = userEvent.setup()
    renderChat()
    await screen.findByPlaceholderText('Digite uma mensagem…')

    const file = new File(['abc'], 'x.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]')
    await user.upload(input, file)

    // Preview aparece com o nome + botão enviar.
    expect(await screen.findByText('x.png')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /enviar anexo/i }))

    const [url, body] = api.post.mock.calls[0]
    expect(url).toBe('/messages/attachment')
    expect(body).toBeInstanceOf(FormData)
  })

  it('rejeita arquivo acima de 5MB com toast, sem enviar', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    renderChat()
    await screen.findByPlaceholderText('Digite uma mensagem…')

    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' })
    const input = document.querySelector('input[type="file"]')
    await user.upload(input, big)

    expect(toast.warning).toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('renderiza imagem recebida como <img> e PDF como link', async () => {
    api.get.mockImplementation((url) => {
      if (url.startsWith('/messages/history/')) {
        return Promise.resolve({ data: { peer: { id: 'bob', name: 'Bob', role: 'CUIDADOR' }, messages: [
          { id: 'm1', senderId: 'bob', receiverId: 'ana', attachmentType: 'image', attachmentUrl: '/uploads/foto.png', attachmentName: 'foto.png', createdAt: Date.now() },
          { id: 'm2', senderId: 'bob', receiverId: 'ana', attachmentType: 'pdf', attachmentUrl: '/uploads/exame.pdf', attachmentName: 'exame.pdf', createdAt: Date.now() },
        ] } })
      }
      return Promise.resolve({ data: {} })
    })
    renderChat()

    const img = await screen.findByRole('img', { name: /foto\.png/i })
    expect(img.getAttribute('src')).toContain('/uploads/foto.png')
    const link = screen.getByRole('link', { name: /exame\.pdf/i })
    expect(link.getAttribute('href')).toContain('/uploads/exame.pdf')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/pages/Chat/ChatComposer.test.jsx`
Expected: FAIL (não há input de arquivo / preview / render de anexo)

- [ ] **Step 3: Importar ícones + whitelist no Chat**

Em `frontend/src/pages/Chat/index.jsx`, adicionar aos imports de ícones:

```js
import AttachFile from '@mui/icons-material/AttachFile'
import PictureAsPdf from '@mui/icons-material/PictureAsPdf'
import InsertDriveFile from '@mui/icons-material/InsertDriveFile'
```

E uma constante de whitelist (perto do `API_URL`, no topo do módulo):

```js
const ATTACHMENT_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
```

- [ ] **Step 4: Estado + ref + handlers de anexo**

Adicionar estado (junto dos outros `useState`) e um ref pro input:

```js
  const [pendingFile, setPendingFile] = useState(null)
  const fileInputRef = useRef(null)
```

Adicionar os handlers (perto de `handleSend`):

```js
  const handlePickFile = useCallback((e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reescolher o mesmo arquivo depois
    if (!file) return
    if (!ATTACHMENT_MIMES.includes(file.type)) {
      toast.warning('Envie imagem (JPG/PNG/WEBP/GIF) ou PDF.')
      return
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.warning('Arquivo muito grande (máx. 5MB).')
      return
    }
    setPendingFile(file)
  }, [])

  const handleSendAttachment = useCallback(async () => {
    if (!pendingFile || sending) return
    setSending(true)
    try {
      const formData = new FormData()
      formData.append('file', pendingFile)
      formData.append('receiverId', peerId)
      const res = await api.post('/messages/attachment', formData)
      const novaMensagem = res.data.message
      setMessages((prev) => [...prev, novaMensagem])
      socket.emit('notify_message', { receiverId: peerId, preview: '📎 Anexo', messageId: novaMensagem.id })
      setPendingFile(null)
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível enviar o anexo.')
    } finally {
      setSending(false)
    }
  }, [pendingFile, sending, peerId, socket])
```

- [ ] **Step 5: Input oculto + botão de anexo + preview no composer**

No `<div className="max-w-3xl mx-auto flex gap-2 items-end">`, logo após o `EmojiPicker` (da Task 4), adicionar o input oculto + botão de anexo (visível no modo digitação):

```jsx
          {!isRecording && !audioBlob && !pendingFile && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handlePickFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 rounded-xl bg-gray-100 text-virla-roxo flex items-center justify-center hover:bg-gray-200 transition-all"
                aria-label="Anexar arquivo"
              >
                <AttachFile sx={{ fontSize: 24 }} />
              </button>
            </>
          )}
```

Adicionar o preview do anexo pendente — como um novo ramo condicional no composer. O bloco condicional atual é `isRecording ? (...) : audioBlob ? (...) : (<textarea>)`. Trocar por incluir `pendingFile` (o preview de anexo vem antes do textarea):

```jsx
          {isRecording ? (
            /* ...bloco de gravação existente, inalterado... */
          ) : audioBlob ? (
            /* ...bloco de preview de áudio existente, inalterado... */
          ) : pendingFile ? (
            <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 min-h-[44px] border border-gray-200">
              <button type="button" onClick={() => setPendingFile(null)} className="text-gray-500 hover:text-red-500 p-1" aria-label="Cancelar anexo">
                <Delete sx={{ fontSize: 20 }} />
              </button>
              {pendingFile.type === 'application/pdf' ? (
                <span className="flex items-center gap-2 text-sm text-virla-texto truncate">
                  <PictureAsPdf sx={{ fontSize: 20 }} className="text-red-600" />
                  {pendingFile.name}
                </span>
              ) : (
                <img src={URL.createObjectURL(pendingFile)} alt={pendingFile.name} className="h-9 w-9 object-cover rounded" />
              )}
              <span className="text-xs text-virla-muted truncate flex-1">{pendingFile.name}</span>
            </div>
          ) : (
            /* ...textarea existente, inalterado... */
          )}
```

E o botão de enviar (à direita) deve enviar o anexo quando há `pendingFile`. O bloco final do botão é `(!input.trim() && !audioBlob && !isRecording) ? (<mic>) : (<submit>)`. Ajustar para: quando há `pendingFile`, mostrar um botão de enviar anexo:

```jsx
          {pendingFile ? (
            <button
              type="button"
              onClick={handleSendAttachment}
              disabled={sending}
              className="h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 rounded-xl bg-virla-roxo text-white flex items-center justify-center hover:bg-virla-roxohighlight shadow-md disabled:opacity-50 transition-all"
              aria-label="Enviar anexo"
            >
              {sending ? <ButtonSpinner size={22} /> : <Send sx={{ fontSize: 22 }} />}
            </button>
          ) : (!input.trim() && !audioBlob && !isRecording) ? (
            /* ...botão de mic existente, inalterado... */
          ) : (
            /* ...botão de enviar (submit) existente, inalterado... */
          )}
```

- [ ] **Step 6: Render de anexo nas mensagens**

No `.map` das mensagens, o corpo hoje é `m.deleted ? (tombstone) : m.audioUrl ? (<audio>) : (<p>content</p>)`. Adicionar os ramos de anexo antes do texto:

```jsx
                {m.deleted ? (
                  /* ...tombstone existente, inalterado... */
                ) : m.attachmentType === 'image' ? (
                  <a href={`${API_URL}${m.attachmentUrl}`} target="_blank" rel="noreferrer">
                    <img
                      src={`${API_URL}${m.attachmentUrl}`}
                      alt={m.attachmentName || 'imagem'}
                      className="max-w-full max-h-64 rounded-lg"
                    />
                  </a>
                ) : m.attachmentType === 'pdf' ? (
                  <a
                    href={`${API_URL}${m.attachmentUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 underline"
                  >
                    <InsertDriveFile sx={{ fontSize: 20 }} />
                    {m.attachmentName || 'documento.pdf'}
                  </a>
                ) : m.audioUrl ? (
                  /* ...player de áudio existente, inalterado... */
                ) : (
                  /* ...<p>{m.content}</p> existente, inalterado... */
                )}
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/pages/Chat/ChatComposer.test.jsx`
Expected: PASS (emoji + 3 testes de anexo)

- [ ] **Step 8: Suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS (sem regressão)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/Chat/index.jsx frontend/src/pages/Chat/ChatComposer.test.jsx
git commit -m "feat(chat): anexo imagem/PDF no composer + render inline [CHAT-02]"
```

---

### Task 6: Verificação final da branch

**Files:** nenhum — só validação.

- [ ] **Step 1: Suíte completa do backend**

Run: `cd backend && node --test`
Expected: PASS, 100%

- [ ] **Step 2: Suíte completa do frontend**

Run: `cd frontend && npx vitest run`
Expected: PASS, 100%

- [ ] **Step 3: Build do frontend**

Run: `cd frontend && npm run build`
Expected: build sem erros

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: sem novos erros/warnings vs. baseline da main (mesma contagem)

- [ ] **Step 5: Atualizar o roadmap**

Em `docs/ROADMAP-melhorias-fabio.md`, na linha "CHAT-02 (restante)" da Fase 4, marcar emojis e imagens/arquivos como concluídos (fechando o CHAT-02). Exemplo:

```markdown
| **CHAT-02 (restante)** | **XG** | ✅ **Concluído** (branches de chat). Typing, leitura (✓✓), envio (✓), apagar (CHAT-01), sair/arquivar, presença/visto por último, **emojis** e **imagens+arquivos** (imagem/PDF via disco local, branch `chat-anexos-emojis`). CHAT-02 fechado. |
```

```bash
git add docs/ROADMAP-melhorias-fabio.md
git commit -m "docs(roadmap): CHAT-02 fechado (emojis + imagens/arquivos)"
```

---

## Notas de escopo / decisões herdadas do spec

- **`/uploads` público** com nome-hash — aceito no MVP (igual ao áudio).
- **Deploy efêmero:** anexos somem em redeploy sem disco persistente — mesma limitação do áudio; fora de escopo.
- **`URL.createObjectURL`** no preview: o browser revoga ao descartar a página; para o MVP não revogamos manualmente (preview é efêmero e único por vez). Se o lint/PR pedir, dá pra revogar no cancelar/enviar.
- **Um anexo por mensagem**, sem legenda de texto junto.
- **Fora de escopo:** Firebase Storage; tipos arbitrários; múltiplos anexos; legenda; busca/skin tones no emoji; resize/compressão; GC de órfãos em `/uploads`.
