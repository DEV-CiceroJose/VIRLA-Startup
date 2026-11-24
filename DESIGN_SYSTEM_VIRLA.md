# VIRLA — Design System e Redesign Human Care Technology

## Direção aprovada

- Direção visual: Human Care Technology.
- Temas: claro e escuro.
- Abrangência: plataforma completa.
- Prioridades: design e experiência do usuário.
- Identidade: preservar a paleta roxa já definida no repositório.

## Paleta oficial preservada

| Token | Valor claro/original |
|---|---|
| Roxo principal | `#800080` |
| Roxo destaque | `#9932CC` |
| Roxo profundo | `#5a0a5a` |
| Lilás | `#d8b4de` |
| Neve | `#FFFAFA` |
| Texto | `#333333` |
| Texto secundário | `#6b6470` |

No tema escuro, a marca continua roxa. Apenas superfícies, textos, bordas e estados de interface recebem equivalentes de contraste adequados.

## Princípios visuais

1. Humanização: fotografia natural e conteúdo acolhedor, sem perder profissionalismo.
2. Clareza: hierarquia tipográfica, textos legíveis e ações previsíveis.
3. Confiança: estados de verificação, avaliações, pagamentos e segurança fáceis de compreender.
4. Consistência: componentes compartilhados entre as áreas de familiar e cuidador.
5. Acessibilidade: foco visível, contraste, navegação por teclado e respeito a movimento reduzido.
6. Responsividade: experiência coerente em celular, tablet e desktop.

## Implementação inicial

- `src/design-system/tokens.css`: cores, superfícies, bordas, sombras e primitivas.
- `src/design-system/theme/ThemeProvider.jsx`: estado do tema, preferência do sistema e persistência local.
- `src/design-system/theme/ThemeToggle.jsx`: controle acessível de alternância.
- `src/index.css`: aplicação dos tokens no estilo global.

## Shell da área logada e painel

- `src/design-system/dashboard.css` (prefixo `vd-`): sidebar roxo-escura, conteúdo em "folha" clara com canto superior esquerdo arredondado, topbar com busca/notificações/usuário e o painel inicial. Tokens `--vd-*` com variantes claro/escuro.
- `src/components/Topbar`: barra superior (desktop). `src/components/Avatar`: foto ou iniciais.
- `AppShell` envolve as telas logadas em `.vd-main > .vd-main-panel`; o chat fica fora (layout próprio).
- Painel (`pages/Home`): saudação, banner de destaque (pedidos/oportunidades), cartão de indicador + ações, agenda agrupada por data, notificações e mensagens. O aviso de perfil incompleto fica no cartão de progresso da sidebar (desktop) e num aviso compacto no celular.

## Próximas etapas

1. Auditar todas as páginas, componentes e estilos existentes.
2. Migrar navegação e componentes compartilhados para tokens semânticos.
3. Atualizar landing page e autenticação.
4. Redesenhar painéis de familiar e cuidador.
5. Redesenhar busca, contratação, solicitações e chat.
6. Redesenhar perfil, pagamentos e configurações.
7. Validar acessibilidade, responsividade, testes, lint e build.

## Restrições de escopo

O redesign é visual e de UX. Não alterar regras de negócio, autenticação Firebase, permissões, matching, APIs, pagamentos ou integrações sem uma necessidade técnica documentada e testes específicos. Não publicar automaticamente em produção.
