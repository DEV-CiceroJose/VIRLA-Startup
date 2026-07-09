# Chat — Presença online + "visto por último" (CHAT-02 / PROD-01) — Design

> Primeiro sub-projeto do guarda-chuva CHAT-02, decomposto no brainstorm. O
> restante do CHAT-02 vira sub-projetos próprios: **emojis** (seletor no
> composer) e **imagens + arquivos** (mesmo pipeline de upload). Já **prontos**
> de trabalho anterior: typing ("digitando…"), leitura (✓✓) e envio (✓).

## Contexto: o que já existe

- O chat roda no **Firebase Realtime Database (RTDB)**; o Firestore só guarda
  perfis.
- O backend **já faz broadcast** de `user:online`/`user:offline` via Socket.io
  (`backend/src/events/authEvents.js`), mas o **frontend não consome** esses
  eventos (o `SocketContext` só trata `receive_message_notify`). Não há
  persistência de "visto por último" em lugar nenhum.
- O header do Chat (`frontend/src/pages/Chat/index.jsx:320-325`) mostra hoje um
  subtítulo com `{peer.approach || papel}`.
- O app já move sinais em tempo real pro RTDB justamente porque o Socket.io
  sofria com reconexão/upgrade de WebSocket em produção.

## Decisões (tomadas com o usuário)

1. **Escopo de exibição:** só no **header do Chat** (dentro da conversa aberta).
   Nada na lista de conversas por enquanto.
2. **Privacidade:** "visto por último" **sempre visível**, sem toggle (MVP).
3. **Mecanismo:** **presença nativa do RTDB via `onDisconnect`** (padrão
   canônico do Firebase), não Socket.io — mesma lógica que levou as mensagens
   pro RTDB. Robusto a crash/queda/fechar aba, e é o que torna o "visto por
   último" confiável.
4. Um "entregue" separado (✓✓ cinza antes de ✓✓ azul de lido) foi **descartado**
   (YAGNI) — o envio (✓) e leitura (✓✓) já existem.

## Modelo de dados

Nó novo no RTDB:

```
status/{uid} = { state: 'online' | 'offline', lastChanged: <server timestamp ms> }
```

## Regra de segurança (nova)

Adicionar um nó `status` de topo em `backend/firebase.rules.json`:

```json
"status": {
  "$uid": {
    ".read": "auth != null",
    ".write": "auth != null && auth.uid == $uid"
  }
}
```

- **Leitura:** qualquer usuário autenticado (pra ver a presença de peers).
- **Escrita:** só o próprio uid.

> ⚠️ **Cutover:** esta feature **altera** `backend/firebase.rules.json`, então
> as regras precisam ser republicadas no cutover do Firebase (já é um passo
> documentado do cutover).

## Publicar a própria presença (app-wide)

Novo hook `usePresence(uid)` em `frontend/src/hooks/usePresence.js`, acionado por
um componente `<PresenceManager />` montado **uma vez** no `AppShell` (dentro do
`SocketProvider`), que lê `firebaseUser?.uid` do `AuthContext`. Usa o Web SDK do
Firebase:

- Assina o caminho especial `.info/connected`.
- Quando `connected === true`:
  1. **Primeiro** registra `onDisconnect(statusRef).set({ state:'offline', lastChanged: serverTimestamp() })` — o servidor do Firebase dispara isso ao cair a conexão (fechar aba, crash, queda de rede).
  2. **Depois** `set(statusRef, { state:'online', lastChanged: serverTimestamp() })`.
- Fonte do uid: o `usePresence(uid)` recebe o uid como argumento; um componente
  `<PresenceManager />` montado no `AppShell` passa `firebaseUser?.uid` do
  `AuthContext` (`useAuth()`), que é **reativo** a login/logout (o `localStorage
  'meuId'` não dispararia re-render). Com `uid` nulo (deslogado), o hook no-opa.
- **Resiliência:** se `isFirebaseReady()` for falso ou `rtdb` não existir, o hook
  **no-opa** — a presença simplesmente não aparece, consistente com o fallback
  HTTP do chat. Nunca derruba a tela.
- `serverTimestamp` é o sentinel do RTDB (`firebase/database`'s `serverTimestamp()`),
  resolvido pelo servidor na escrita.

## Assinar a presença do peer (Chat)

Novo hook `usePeerPresence(peerId)` em `frontend/src/hooks/usePresence.js`
(mesmo arquivo, exportações separadas):

- `onValue(ref(rtdb, \`status/${peerId}\`), cb)` → estado
  `{ state, lastChanged } | null`.
- No-opa (devolve `null`) se Firebase indisponível ou `peerId` ausente.
- Limpa o listener no unmount / troca de `peerId`.

## Formatação de "visto por último" (pura, testável)

Novo util `frontend/src/utils/lastSeen.js`:

```
formatLastSeen(ms, nowMs = Date.now()) => string (pt-BR)
```

Regras (nessa ordem):
- `ms` ausente/inválido → `''`
- `< 60_000` (menos de 1 min) → `'agora mesmo'`
- `< 3_600_000` (menos de 1h) → `'há N min'` (N = floor(diff/60000), mínimo 1)
- mesmo dia civil → `'hoje às HH:MM'`
- dia civil anterior → `'ontem às HH:MM'`
- mais antigo → `'DD/MM às HH:MM'`

`HH:MM` e `DD/MM` via `toLocaleTimeString`/`toLocaleDateString('pt-BR')` ou
composição manual com zero à esquerda (determinístico nos testes passando
`nowMs`).

## Render no header do Chat

O subtítulo em `Chat/index.jsx` (hoje `{peer?.approach || papel}`) passa a ser
sensível à presença, usando `usePeerPresence(peerId)`:

- `state === 'online'` → um **pontinho verde** + `'online'`.
- senão, se `lastChanged` existir → `'visto por último ' + formatLastSeen(lastChanged)`.
- senão (sem dado de presença / RTDB indisponível) → **fallback** pro texto atual
  de `approach`/papel.

O usuário **não** vê a própria presença (só assina a do peer).

## Testes

- `formatLastSeen` — testes unitários puros (vitest), cobrindo cada bucket
  (`''` p/ vazio, "agora mesmo", "há N min", "hoje às", "ontem às", "DD/MM às"),
  com `nowMs` fixo pra determinismo. Padrão dos helpers de chat já existentes.
- Os hooks `usePresence`/`usePeerPresence` dependem de `.info/connected`,
  `onDisconnect` e `onValue` do Firebase e **não** são unit-testáveis de forma
  limpa — verificados por `npm run build` + suíte verde + os testes do
  formatador. Mesma profundidade de teste adotada pro hook `useFirebaseChat`.
- Sem testes de backend: a presença é client-driven (RTDB + regra); não há
  controller. A regra nova é validada no cutover do Firebase.

## Edge cases & riscos

- **Multi-aba:** `onDisconnect` é por-conexão — fechar uma de duas abas marca o
  usuário offline mesmo com a outra aberta (a aba sobrevivente reafirma online
  quando `.info/connected` está true, mas pode haver um flicker). O fix robusto
  (chaves por-conexão em `status/{uid}/connections/{id}`) é mais complexidade que
  o MVP justifica — **anotado**, mantendo a receita simples (usuários do app
  raramente usam multi-aba).
- **Skew de relógio:** `lastChanged` é timestamp do **servidor** Firebase; a
  formatação relativa compara com `Date.now()` do cliente. Skew sub-minuto é
  irrelevante pra "há N min".
- **RTDB indisponível:** hooks no-opam; header mostra o subtítulo de papel.
  Degradação graciosa.
- **Presença própria:** só assina o peer, nunca renderiza a própria — sem
  auto-exibição.

## Verificação

Mesmo padrão das fases anteriores: frontend `vitest run` verde, `npm run build`
OK, delta de lint 0 vs. baseline da main. (Backend `node --test` roda mas esta
feature não toca backend a não ser pela regra do RTDB.)

## Fora de escopo

- Presença na lista de conversas (Home).
- Toggle de privacidade de "visto por último".
- Estado "entregue" separado de enviado/lido.
- Fix multi-aba com chaves por-conexão.
- Os outros sub-projetos do CHAT-02 (emojis; imagens+arquivos).
