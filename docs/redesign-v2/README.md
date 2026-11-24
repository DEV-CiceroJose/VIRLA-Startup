# 🎨 VIRLA — Redesign v2 (branch `redesingv2`)

> **Para quem chega agora (inclusive você, em outra máquina):** este arquivo é o "mapa do tesouro".
> Leia de cima para baixo, siga o 🧭 *Como continuar* e cole o 🤖 *prompt pronto* numa nova sessão do Claude Code.

---

## 🗺️ Onde estamos na jornada

```
 Landing ──── Painel ──── Chat ──── Finanças ──── Perfil cuidador ──── Feed ──── Solicitações ──── Perfil/Pagamento
  (ref 1)    ✅ (ref 5)  ✅ (ref 4)   ⏳ (ref 3)       ⏳ (ref 2)          ⏳          ⏳                  ⏳
```

✅ feito · ⏳ falta

As imagens de referência estão em [`referencias/`](./referencias):

| Ref | Arquivo | Usar em |
|---|---|---|
| 1 | `ref-1-landing.webp` | Landing page (`/`) |
| 2 | `ref-2-perfil-cuidador.webp` | Perfil público do cuidador (`/user/:id`) e cards do Feed |
| 3 | `ref-3-financas-transacoes.webp` | Finanças do cuidador (`/financas`) — histórico tipo "transaction history" |
| 4 | `ref-4-chat.webp` | Chat (`/chat/:id`) ✅ |
| 5 | `ref-5-painel.webp` | Painel inicial (`/home`) ✅ — **a mais fiel** |

---

## 🎯 A regra de ouro

**Seguir a estrutura das referências, mas manter a identidade da VIRLA:**

- 💜 Cores: roxo `#800080`, roxo destaque `#9932CC`, roxo profundo `#5a0a5a`, lilás `#d8b4de` (ver `DESIGN_SYSTEM_VIRLA.md`).
- ✍️ Tipografia: **Playfair Display** nos títulos/números de destaque, **DM Sans** no resto.
- 🌗 Tema claro e escuro sempre funcionando (use os tokens `--vd-*`, nunca cor fixa solta).
- 📱 Responsivo: 375px sem rolagem horizontal.
- 🚫 Não mexer em regra de negócio, Firebase, pagamentos, matching ou APIs — o redesign é só visual/UX.

---

## ✅ O que já foi feito

### 1. Shell da área logada (vale para todas as telas logadas)
- **Sidebar roxo-escura** com ícones contornados e item ativo destacado.
- **Cartão "Quase lá"** no rodapé da sidebar com anel de % do perfil (usa `computeCompleteness`) e botão "Completar perfil" lilás. Dá para fechar (lembra na sessão do navegador).
- **"Folha" clara** com canto superior esquerdo arredondado sobre o fundo escuro.
- **Topbar** (desktop): busca (familiar → `/feed?busca=...`; cuidador → solicitações), botão de tema, sino de notificações e usuário (avatar/iniciais, selo verificado, papel).
- **Botão de tema**: na área logada fica na topbar (desktop) e no cabeçalho (celular). O botão flutuante só aparece nas páginas públicas.
- Solicitações e Pagamento, que ficavam *debaixo* da sidebar no desktop, agora ficam dentro da folha.

### 2. Painel `/home` (ref 5)
- Saudação "Olá, nome 👋".
- Banner roxo com contador: pedidos em andamento (familiar) / novas oportunidades (cuidador).
- Cartão escuro de indicador: conversas ativas (familiar) / total recebido ou valor-hora (cuidador) + 2 cartões de ação com ícone.
- Agenda agrupada por data (dia da semana + número) com itens em pílulas lilás.
- Coluna direita: Notificações e Mensagens.
- `/home?tab=mensagens` mostra a lista completa de conversas no mesmo estilo.
- Saíram do painel: cabeçalho roxo com dados pessoais e "Apresentação" (já existem em `/perfil`).

### 3. Chat `/chat/:id` (ref 4)
- Agora dentro do shell. Lista à esquerda (busca, abas **Todas / Não lidas** com contadores, horário, badge de não lidas — vindo das notificações `MESSAGE`).
- Cabeçalho: avatar, nome, online/visto por último, chip do papel, ações Ver perfil / Cobrança / Pagar / Sair.
- Fundo com padrão sutil, separadores "Ontem/Hoje", bolhas recebidas brancas e enviadas lilás, ✓✓ roxo quando lida.
- Composer: anexo, emoji, campo, botão redondo roxo (microfone ↔ enviar).
- No celular só a conversa aparece, com botão voltar.
- **Toda a lógica (Firebase, socket, áudio, anexos, cobrança, apagar, sair) ficou intacta.**

### 📁 Arquivos principais

| Arquivo | O quê |
|---|---|
| `frontend/src/design-system/dashboard.css` | Tokens `--vd-*` (claro/escuro), shell, topbar, painel |
| `frontend/src/design-system/chat.css` | Estilos do chat (`vc-*`) |
| `frontend/src/components/Topbar/index.jsx` | Barra superior |
| `frontend/src/components/Avatar/index.jsx` | Avatar foto/iniciais |
| `frontend/src/components/Menu/index.jsx` | Sidebar nova + cartão de progresso + tema no mobile |
| `frontend/src/AppShell.jsx` | Envolve rotas logadas em `.vd-main > .vd-main-panel` |
| `frontend/src/pages/Home/index.jsx` | Painel |
| `frontend/src/pages/Chat/index.jsx` | Chat (só a renderização mudou) |
| `frontend/src/design-system/theme/ThemeToggle.jsx` | Variante `inline` |
| `frontend/src/components/EmojiPicker.jsx` | Prop `buttonClassName` |
| `frontend/src/pages/Feed/index.jsx` | Lê `?busca=` |

Convenção de nomes CSS: `vd-` = shell/painel, `vc-` = chat. Para telas novas, siga o padrão (ex.: `vf-` finanças, `vp-` perfil).

---

## 🧭 Como continuar em outra máquina

1. **Clonar e entrar na branch**
   ```powershell
   git clone https://github.com/DEV-CiceroJose/VIRLA-Startup.git
   cd VIRLA-Startup
   git checkout redesingv2
   ```
2. **Node** — qualquer LTS recente. Se usar **Node 25/26**, antes dos testes rode (o `localStorage` nativo do Node atrapalha o jsdom):
   ```powershell
   $env:NODE_OPTIONS="--no-experimental-webstorage"
   ```
3. **Dependências e checagens**
   ```powershell
   cd frontend
   npm ci
   npm test
   npm run build
   ```
   Estado atual: **145/145 testes passando** e build ok.
4. **Ver no navegador:** `npm run dev` (precisa do backend + Firebase para logar).
   *Sem backend?* Dá para montar um "harness" temporário (não commitado): um `vite.config` extra com um plugin que troca `AuthContext`, `NotificationContext`, `SocketContext`, `services/api`, `services/auth` e os hooks `usePresence`, `useFirebaseChat`, `useSocket`, `useAudioRecorder` por mocks com dados falsos. Atenção: rode o Vite com `cwd` = `frontend/`, senão o Tailwind não gera as classes.

---

## ⏳ O que falta (em ordem sugerida)

1. **Finanças `/financas` (ref 3)** — virar "histórico de transações": abas (Todos / Recebidos / A receber), filtros (busca, período, status), linhas com ícone de entrada/saída, descrição, **badge de status colorido** (Recebido verde, Aguardando âmbar, Reembolsado vermelho…), data e valor alinhado à direita. Cards de resumo no topo no estilo dos cartões do painel. Dados: `GET /payments/caregiver/summary` (`entries[]`, `status`, `amountCents`, `serviceDate`).
2. **Perfil público do cuidador `/user/:id` (ref 2)** — card com foto grande (ou iniciais), nome em Playfair, chips "A partir de R$ X/h · N anos de experiência", checklist "Verificado (CRM/COREN) ✓", botão principal "Conversar"/"Contratar", bloco "Prefere conversar antes?" com botão secundário, seções Sobre e Especialidades.
3. **Feed `/feed`** — cards de cuidador no mesmo idioma da ref 2 (foto, nome, preço/h, selos, botão).
4. **Solicitações `/solicitacoes` e `/solicitacoes-disponiveis`** — listas/cards com o visual do painel (pílulas de data, badges de status).
5. **Perfil próprio `/perfil` e Pagamento** — formulários com cartões `vd-panel`, inputs com o estilo da busca (borda `--vd-line`, foco roxo).
6. **Landing `/` (ref 1)** — hero com foto + título Playfair, seções de serviços alternando imagem/texto, "Por que a VIRLA", depoimentos, "Como funciona", CTA final e rodapé roxo-escuro (no lugar do verde da ref).
7. **Faxina final** — remover regras órfãs de `comfort.css` (sidebar antiga `comfort-sidebar`, `comfort-chat*`, `comfort-home*`), revisar acessibilidade (contraste no escuro, foco visível), conferir tudo a 375px.

### ⚠️ Pendências conhecidas (já existiam antes do redesign)
- Lint: `react-hooks/set-state-in-effect` em `Menu` (linha do "fechar drawer ao trocar de rota") e no `Chat` (efeito de carregamento), e 2 `no-unused-vars` (`e`, `err`) no `Chat`.
- `NotificationBell` tem o dropdown com fundo branco fixo (não acompanha o tema escuro).

---

## 🤖 Prompt pronto para a próxima sessão

Cole isto no Claude Code, na raiz do repositório, já na branch `redesingv2`:

```
Estamos continuando o redesign da VIRLA na branch redesingv2.
Leia docs/redesign-v2/README.md e DESIGN_SYSTEM_VIRLA.md antes de tudo.
As referências estão em docs/redesign-v2/referencias/.
Próxima tela: Finanças (/financas) seguindo a ref-3, mantendo a identidade VIRLA
(roxo/lilás, Playfair Display + DM Sans, tokens --vd-*, tema claro/escuro, responsivo).
Não altere lógica de negócio. Ao final rode npm test e npm run build no frontend
e atualize o mapa "Onde estamos na jornada" deste README.
```

---

*Última atualização: 23/11/2026 — painel (ref 5) e chat (ref 4) concluídos.*
