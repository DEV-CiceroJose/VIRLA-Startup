# 🎨 VIRLA — Redesign v2 (branch `redesingv2`)

> **Para quem chega agora (inclusive você, em outra máquina):** este arquivo é o "mapa do tesouro".
> Leia de cima para baixo, siga o 🧭 *Como continuar* e use o 📌 *resumo para retomar* no fim do arquivo.

---

## 🗺️ Onde estamos na jornada

```
 Landing ──── Painel ──── Chat ──── Finanças ──── Perfil cuidador ──── Feed ──── Solicitações ──── Perfil/Pagamento
 ✅ (ref 1)  ✅ (ref 5)  ✅ (ref 4)   ✅ (ref 3)       ✅ (ref 2)       ✅ (ref 2)     ✅                  ✅
```

✅ feito · ⏳ falta

As imagens de referência estão em [`referencias/`](./referencias):

| Ref | Arquivo | Usar em |
|---|---|---|
| 1 | `ref-1-landing.webp` | Landing page (`/`) |
| 2 | `ref-2-perfil-cuidador.webp` | Perfil público do cuidador (`/user/:id`) ✅ e cards do Feed |
| 3 | `ref-3-financas-transacoes.webp` | Finanças do cuidador (`/financas`) — histórico tipo "transaction history" ✅ |
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

### 4. Finanças `/financas` (ref 3)
- Resumo: cartão escuro "Recebido" (valor grande em Playfair) + "A receber" e "Seu valor por hora". No celular os dois secundários ficam lado a lado.
- Histórico com abas **Todos / Recebidos / A receber** (com contadores) e filtros de **período** e **situação**.
- Linhas **agrupadas por mês**, com o total recebido e a receber do mês no cabeçalho do grupo.
- Cada linha: ícone por tom (entrada verde, relógio âmbar, devolução/análise vermelho), "Atendimento de 18 de novembro", explicação curta, badge de status em texto normal (sem caixa alta), data e valor à direita (`+` quando recebido, riscado quando reembolsado). No celular a coluna de data some (já está no título).
- **Diferença consciente da ref:** sem busca por remetente — `GET /payments/caregiver/summary` não traz o nome da família, então a busca ficaria vazia. Também sem botão de download (ainda não existe comprovante por atendimento).
- Estados: carregando, erro, sem atendimentos (leva a `/solicitacoes-disponiveis`) e "nenhum atendimento com esses filtros" (com Limpar filtros).
- Tons de status usam os tokens compartilhados `--vd-ok`, `--vd-wait`, `--vd-risk` (+ `-bg`) de `dashboard.css`, com variante escura. Use-os em qualquer badge de status (Solicitações, Pagamento…).
- Testes em `pages/Financas/Financas.test.jsx` (resumo, agrupamento, abas, filtros, vazio, erro).

### 5. Perfil público `/user/:id` (ref 2)
- **Desktop:** cartão de identidade à esquerda (fixo na rolagem só em telas com 920px+ de altura) e seções à direita. **Celular:** retrato de ponta a ponta com o cartão subindo por cima, como na ref mobile.
- Retrato grande; sem foto, as **iniciais em Playfair sobre lilás** (vira o destaque visual em vez de um ícone genérico).
- Nome em Playfair, linha "Profissional de cuidado, 37 anos", chips de valor/hora e cidade.
- Verificação: "Registro profissional" com conselho + número e ✓ verde; se não houver, "Ainda não informado" (sem ✓).
- Ação principal **"Conversar com {primeiro nome}"** → `/chat/:id`. Bloco alternativo da ref virou **"Prefere descrever o que precisa? → Publicar solicitação"** (só para quem visita como familiar), porque a contratação na VIRLA acontece pelas solicitações.
- Seções: Sobre, Especialidades, Disponibilidade (turnos + frequência), Como {nome} trabalha.
- **Diferenças conscientes da ref:** sem "anos de experiência" e sem "a partir de" — a API (`USER_PUBLIC_SELECT`) não tem esse campo e o valor/hora é fixo.
- Navegação: "Buscar cuidadores › Nome" para familiar; "Início › Nome" para cuidador; no celular vira só "← Buscar cuidadores".
- Testes em `pages/User/User.test.jsx`.

### 6. Correção no shell
- `comfort.css` força `.comfort-page { background:#faf7f8 !important }`; o override só existia no desktop. No **celular com tema escuro** o texto ficava claro sobre fundo claro (Painel, Finanças, Perfil). Agora `.vd-main .comfort-page` usa `--vd-canvas` em qualquer largura.

### 7. Landing `/`
- **Hero mantida** do modelo novo (aprovada): título serifado grande, arco com foto. Corrigido o enquadramento — a foto é paisagem (~2:1) e o arco alto cortava o rosto da filha; agora o arco é `5:5.4` com `object-position: 92% 40%` e os dois rostos aparecem (desktop e celular).
- **Resto da página no ar do site original (virla.com.br):** títulos Playfair 900, etiquetas em pílula lilás, roxo `#7B128A` + rosa neon `#FE91FE`, cartões com borda lilás, faixa roxa em gradiente com pontos, caixa de chamada com brilhos. Todo o conteúdo do site em produção voltou: Márcia + realidade do mercado, barreira da contratação, porto seguro (com o aviso de pagamento fora da plataforma), Por que a VIRLA + números, trajetória (10 marcos com fotos), time, formulários de validação e rodapé.
- **Componentes do 21st.dev** (reproduzidos a partir das demos públicas — o código-fonte lá exige conta; sem dependências novas, só React + CSS, com `prefers-reduced-motion`), em `pages/Landing/components/`:
  - `Marquee` (Magic UI) → faixa "Por onde a VIRLA já passou" abaixo da hero; pausa no hover.
  - `NumberTicker` (Magic UI) → 33 milhões, 1 em cada 3, R$ 12,3 bi, 300 mil, 840 mil contam ao aparecer (leitor de tela ouve o valor final).
  - `HoverCards` (Aceternity "Card Hover Effect") → destaque que desliza entre os cartões da barreira da contratação.
  - `BentoGrid` (Magic UI) → porto seguro; pagamento ocupa a coluna inteira, chat ocupa duas colunas.
  - `ScrollTimeline` (Aceternity "Timeline") → trajetória com título fixo à esquerda e feixe roxo→rosa que acompanha a rolagem; no celular a linha vai para a esquerda.
- O link "Entenda como funciona" da hero leva para "O porto seguro da Márcia".
- Imagens otimizadas em `public/landing/*.jpg` (≈7 MB → ≈1 MB; hero 2,4 MB → 171 KB). Originais intocadas em `public/`.
- Tema escuro com tokens `--l-*` (hero) e `--o-*` (seções) em `pages/Landing/landing.css` (substitui `comfort-landing.css`). `style.css` da landing antiga não é mais importado — pode sair na faxina.
- O rodapé trocou a coluna "Legal" (links `#` sem destino) por "Plataforma" (entrar, criar conta, como funciona). Quando houver páginas de Privacidade/Termos/FAQ, volte com a coluna.
- Testes em `pages/Landing/Landing.test.jsx`.
- **Tema com tinta (21st.dev "Ink Spill Theme Switch")**, em todo o app: na landing, botão sol/lua no cabeçalho (`components/InkThemeToggle.jsx`); no resto, o próprio `ThemeToggle` (topbar, menu do celular e botão flutuante das páginas públicas). A lógica fica em `design-system/theme/inkSpill.js` (+ geometria em `ink.js` e CSS global em `ink-spill.css`). O tema novo "escorre" a partir do botão como uma mancha de tinta. Em vez de renderizar a página duas vezes num palco com rolagem própria (como o original), usa a View Transitions API, então a rolagem e o `ThemeProvider` continuam iguais. Sem suporte à API ou com movimento reduzido, troca na hora. O botão flutuante de tema não aparece em `/`.

### 8. Calendário (todas as datas)
- `components/ui/DatePickerField.jsx` agora abre o `GlassCalendar` (adaptado do "Glass Calendar" do 21st.dev): vidro roxo da VIRLA, só a **visão mensal** (a faixa semanal saiu), leitura da data em **dd/mm/aaaa** e atalhos para mês e ano (útil para nascimento: ano → mês → dia). Setas do teclado andam entre os dias; Esc fecha.
- Usado em todos os campos de data: data de início (Solicitações), data do serviço (relatório), data de nascimento no Cadastro, Completar cadastro e Perfil (antes eram `<input type="date">` nativos).
- Aceita `ref` (lido como um input: `ref.current.value`) para os formulários com `useRef`; `shortcuts={false}` esconde Hoje/Amanhã/Em 7 dias.
- Sem dependências novas (sem `date-fns`, `framer-motion` ou `lucide-react`); datas em `components/ui/dateUtils.js`. Testes em `components/ui/DatePickerField.test.jsx`.

### 9. Feed `/feed` (ref 2)
- Cada profissional virou o cartão da ref 2: retrato (ou iniciais em Playfair sobre lilás, como no perfil público), nome em Playfair com o ✓ de registro, cidade no canto, abordagem em 2 linhas e chips de valor/hora e idade. O chip de papel só aparece para perfis de família (no feed da família todos são cuidadores).
- Até 4 especialidades em pílulas (+N para o resto).
- Compatibilidade redesenhada só para o Feed (`FeedMatch`): número grande em Playfair, régua e os motivos com os pontos; cor pelo nível (`--vd-ok` no excelente, roxo no alto, lilás no bom, neutro no possível). O aviso "confirme os detalhes antes de contratar" saiu de cada cartão e ficou uma vez, acima da lista. O `MatchScore` original continua igual para as outras telas.
- Ação principal de ponta a ponta "Conversar com {nome}" e, abaixo, a alternativa "Quer conhecer melhor? → Ver perfil completo" (mesma regra de antes: só para família vendo cuidador).
- Busca e "Match inteligente para" numa barra só; contagem de perfis e página logo abaixo. Paginação com botões no padrão das outras telas.
- Duas colunas quando cabem cartões de ~470px; uma coluna larga no resto; no celular o retrato encolhe para 84px e a alternativa empilha. Estilos em `design-system/feed.css` (`vfd-*`).

### 10. Login `/login` e Cadastro `/cadastro`
- **Cartão translúcido no centro sobre linhas animadas** (`components/auth/AuthLayout.jsx` + `BackgroundPaths.jsx`, adaptado do "Background Paths" da Kokonut UI no 21st.dev): dois feixes de curvas finas em roxo (lilás no escuro) correm devagar ao fundo, com um véu no centro para o formulário ficar limpo. A versão com foto e cartões de vidro saiu por excesso de informação. Animação só em CSS (`stroke-dashoffset`), parada com movimento reduzido. Logo, "Página inicial" e botão de tema no topo (o botão flutuante não aparece nessas duas rotas).
- **Login:** rótulos visíveis, senha com mostrar/ocultar (`PasswordField`), "Esqueci minha senha", divisor "ou" e botão do Google com o "G". Lógica igual.
- **Cadastro em etapas** com `Stepper` (Origin UI): Conta (cartões "Sou da família" / "Sou cuidador" + Google) → Seus dados (foto, nome, CPF, nascimento) → Registro (só cuidador, opcional) → Acesso (e-mail e senhas). Cada "Continuar" confere só a etapa atual com as mesmas mensagens de antes; o envio final (`createUser`) não mudou. Todas as etapas ficam montadas (só a atual aparece), então "Voltar" mantém o que foi digitado. Etapas feitas viram ✓ e podem ser revisitadas; o foco vai para o título de cada etapa.
- Campos (`Field`, `DatePickerField`, `SelectField`, upload) acompanham o tema escuro nessas telas. Estilos em `design-system/auth.css` (`va-*`).

### 11. Verificação de cuidadores (documentos + antecedentes) — backend e frontend
Decisão do produto: **documentos + revisão pela equipe**, e o cuidador **fica oculto até ser aprovado**.
- **Fluxo:** o cuidador envia (1) documento com foto, (2) selfie segurando o documento e (3) certidão de antecedentes criminais emitida há no máximo 90 dias (link para a emissão gratuita da Polícia Federal), informa o código de validação e a data de emissão e marca a declaração de veracidade. Status: `NAO_ENVIADO → EM_ANALISE → APROVADO | REPROVADO` (reprovado mostra o motivo e permite reenviar).
- **Quem aparece:** o Feed das famílias só lista cuidadores `APROVADO`; `/solicitacoes/disponiveis`, `visualizar` e `assumir` exigem aprovação (`middlewares/requireApprovedCaregiver.js`, 403 com `code: VERIFICATION_REQUIRED`, que a tela trata sem mandar para o login).
- **Equipe VIRLA:** papel novo via custom claim `admin`. Em produção, os e-mails ficam na variável `VIRLA_ADMIN_EMAILS` da Render e recebem o acesso na subida do servidor (`lib/adminBootstrap.js`); para revogar, tire o e-mail e rode `node backend/scripts/set-admin.js email@... --remove`. Tela `/admin/verificacoes` com abas (em análise / aprovadas / reprovadas), prévia dos documentos, dados do cadastro, código da certidão + link para validar no site da PF e checklist obrigatório antes de aprovar. Aprovação/reprovação gera notificação para o cuidador.
- **Segurança dos documentos:** nunca vão para `/uploads` (público). Ficam em memória até serem **cifrados (AES-256-GCM, `lib/fileCrypto.js`)** e gravados **no Firestore em pedaços** (`verificationFiles/{id}/chunks`), o que funciona na Render (disco efêmero) sem o plano pago do Firebase Storage. As regras do Firestore já negam todo acesso de cliente; só o dono e a equipe abrem pela API, e cada acesso da equipe é registrado no log de segurança. Dados ficam na coleção `verifications/{uid}`; o perfil só guarda `verificationStatus` (que aparece no perfil público como "Documentos e antecedentes conferidos").
- **Frontend:** `/verificacao` (menu do cuidador "Verificação") com dropzone adaptada do "File Upload" (Aceternity, 21st.dev), aviso no Painel e na tela de Solicitações. Arquivos: `pages/Verificacao`, `pages/AdminVerificacoes`, `components/verification/DocumentDrop.jsx`, `services/verification.js`, `design-system/verification.css`.
- **Backend:** `routes/verificationRoutes.js`, `controllers/verificationController.js`, `services/verificationDomain.js` (regras puras, testadas), `services/verificationStorage.js`, `repositories/verificationRepository.js`, `middlewares/requireAdmin.js`. Testes: `verificationDomain.test.js`, `fileCrypto.test.js`.

> **Produção:** documentos no Firestore (sem bucket nem plano pago), equipe pela variável `VIRLA_ADMIN_EMAILS`. Os cuidadores que já existem ficam **fora do Feed** até enviarem os documentos e serem aprovados.

### 12. Termos de Uso e Política de Privacidade (aceite obrigatório)
- Páginas públicas `/termos` e `/privacidade` (índice lateral, tema claro/escuro) e links no rodapé do login/cadastro. Texto em `pages/Legal/documents.js` (LGPD: dados coletados, bases legais, compartilhamento, retenção, direitos, verificação de antecedentes).
- No cadastro (última etapa) e no completar cadastro (Google), cada documento abre numa caixa adaptada do "Terms dialog" (Origin UI, 21st.dev): barra de leitura e **"Li e aceito" só libera ao chegar no fim**. Sem aceitar os dois, a conta não é criada.
- O backend exige `acceptedTerms: true` + `termsVersion` igual à vigente (`backend/src/utils/legal.js` e `frontend/src/constants/legal.js`) e grava `termsAcceptedAt`, `termsVersion` e `privacyVersion` no perfil. O perfil mostra a data do aceite.
- Correção junto: depois do cadastro a sessão é encerrada (antes, voltar ao login na mesma aba levava para "completar cadastro").

> ⚠️ **Minuta:** um(a) advogado(a) precisa revisar os textos e preencher `[RAZÃO SOCIAL]`, `[CNPJ]`, `[ENDEREÇO]` e `[ENCARREGADO]`. Ao mudar o texto, suba a versão nos dois arquivos de versão.

### 13. Solicitações `/solicitacoes` e `/solicitacoes-disponiveis`
- Cartão compartilhado `components/requests/RequestCard.jsx`: pílula com a data de início (dia + mês em Playfair), título e status com tokens `--vd-ok/wait/risk`, descrição curta, chips (valor/hora, turno, frequência, cidade, pagamento, urgência), tipos de cuidado e rodapé com datas.
- Abas com pílula deslizante (`components/ui/AnimatedTabs.jsx`, "Animated Tabs" do 21st.dev, com setas do teclado).
- Cuidador: compatibilidade com o `MatchMeter` (o mesmo do Feed, agora em `components/MatchMeter`); sem verificação aprovada aparece o aviso para concluir.
- Família: formulário de nova solicitação em painel, chips de tipo de cuidado com `aria-pressed`. Estilos em `design-system/requests.css` (`vs-`, `vx-`).

### 14. Perfil, Pagamento e Completar cadastro
- **Perfil `/perfil`:** cartão fixo à esquerda (foto/iniciais, papel, % completo, status da verificação, atalhos das seções) e formulário em painéis (Dados pessoais, Foto e valor, Perfil profissional, Onde você atende, Conta e segurança) com barra de salvar sempre visível. Lógica igual. Estilos em `design-system/own-profile.css` (`pf-`).
- **Pagamento `/pagamento`:** resumo escuro com o valor em Playfair, etapas (dados → PIX → confirmação), QR em cartão, contagem regressiva até expirar, "copia e cola" e estados de espera/expirado/pago com tokens. Labels agora associados aos campos. Lógica do PIX igual. Estilos em `design-system/payment.css` (`pg-`). *Não testado no navegador: a rota exige vir do chat com uma cobrança.*
- **Completar cadastro:** mesmo cartão com fundo animado do login, cartões de tipo de conta e aceite obrigatório dos termos.
- **Endereço por CEP (campo único):** `components/ui/CepField.jsx` consulta o ViaCEP ao completar os 8 dígitos e mostra rua, bairro, cidade e UF num cartão (sem campos de cidade/estado). Está no Cadastro (opcional, etapa "Seus dados") e no Perfil para família e cuidador. O backend guarda `street` e `neighborhood` só no perfil próprio; o público continua vendo cidade/UF. A Política de Privacidade passou a citar o endereço e o ViaCEP (versão dos termos `2026-11-24.2`).

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
| `frontend/src/pages/Feed/index.jsx` | Feed (importa `feed.css`; lê `?busca=`) |
| `frontend/src/design-system/feed.css` | Estilos do Feed (`vfd-*`) |
| `frontend/src/components/auth/` | `AuthLayout`, `BackgroundPaths`, `Stepper`, `PasswordField`, `GoogleIcon` (login e cadastro) |
| `frontend/src/design-system/auth.css` | Estilos de login e cadastro (`va-*`) |
| `frontend/src/pages/Financas/index.jsx` | Finanças (importa `finance.css`) |
| `frontend/src/design-system/finance.css` | Estilos de Finanças (`vf-*`) |
| `frontend/src/pages/User/index.jsx` | Perfil público (importa `profile.css`) |
| `frontend/src/design-system/profile.css` | Estilos do perfil público (`vp-*`) |

Convenção de nomes CSS: `vd-` = shell/painel, `vc-` = chat. Para telas novas, siga o padrão (ex.: `vf-` finanças, `vp-` perfil, `vfd-` feed).

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
   Estado atual: **169/169 testes no frontend, 146/146 no backend** e build ok.
4. **Ver no navegador:** `npm run dev` (precisa do backend + Firebase para logar).
   *Sem backend?* Dá para montar um "harness" temporário (não commitado): um `vite.config` extra com um plugin que troca `AuthContext`, `NotificationContext`, `SocketContext`, `services/api`, `services/auth` e os hooks `usePresence`, `useFirebaseChat`, `useSocket`, `useAudioRecorder` por mocks com dados falsos. Atenção: rode o Vite com `cwd` = `frontend/`, senão o Tailwind não gera as classes.

---

## ⏳ O que falta (em ordem sugerida)

1. **Pendências de produção** — revisão jurídica dos Termos/Política e preenchimento de razão social, CNPJ, endereço e encarregado (publicados com os campos entre colchetes); avisar os cuidadores já cadastrados sobre a verificação.
2. **Faxina final** — remover regras órfãs de `comfort.css` (sidebar antiga `comfort-sidebar`, `comfort-chat*`, `comfort-home*`, `comfort-finance*`, `comfort-page-heading`, `comfort-info-note`, `comfort-public-profile`) e `pages/Landing/style.css`, revisar acessibilidade (contraste no escuro, foco visível), conferir tudo a 375px. O cabeçalho do celular continua branco no tema escuro.

### ⚠️ Pendências conhecidas (já existiam antes do redesign)
- Lint: `react-hooks/set-state-in-effect` em `Menu` (linha do "fechar drawer ao trocar de rota") e no `Chat` (efeito de carregamento), e 2 `no-unused-vars` (`e`, `err`) no `Chat`.
- `NotificationBell` tem o dropdown com fundo branco fixo (não acompanha o tema escuro).

---

## 📌 Resumo para retomar o trabalho

Ponto de partida, na raiz do repositório e já na branch `redesingv2`:

```
Estamos continuando o redesign da VIRLA na branch redesingv2.
Leia docs/redesign-v2/README.md e DESIGN_SYSTEM_VIRLA.md antes de tudo.
As referências estão em docs/redesign-v2/referencias/.
Próximo passo: faxina final (comfort.css órfão, Landing/style.css, cabeçalho do celular no escuro, NotificationBell, lint antigo), mantendo a identidade VIRLA
(roxo/lilás, Playfair Display + DM Sans, tokens --vd-*, tema claro/escuro, responsivo).
Não altere lógica de negócio. Ao final rode npm test e npm run build no frontend
e atualize o mapa "Onde estamos na jornada" deste README.
```

---

*Última atualização: 24/11/2026 — painel (ref 5), chat (ref 4), finanças (ref 3), perfil público (ref 2), landing, calendário, Feed, login, cadastro, solicitações, perfil, pagamento, verificação de cuidadores e termos concluídos.*
