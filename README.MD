# VIRLA - Conectando Famílias e Cuidadores

Este é o repositório oficial do MVP da **VIRLA**, uma plataforma desenvolvida para conectar famílias que precisam de assistência a cuidadores qualificados, com um fluxo de ponta a ponta: do cadastro ao pagamento integrado via Abacate Pay.

Projeto desenvolvido para apresentação de conclusão de Bootcamp (Maio/2026).

---

## A Equipe e Contribuições

Este projeto foi construído a muitas mãos, com cada membro do time assumindo frentes cruciais para a entrega do MVP. Abaixo, o papel e a contribuição de cada um:

* **Joéverton:**
  Criou a base estrutural de todo o código-fonte, abrangendo o Back-end inicial, a modelagem do Banco de Dados e a fundação do Front-end.

* **Alissomberg:**
  Construiu o Back-end de autenticação, o front-end inicial de login e cadastro, as versões base do feed e da edição de perfil, e a versão inicial do chat integrado. Também teve forte atuação na integração do banco de dados (Prisma & MongoDB).

* **Cícero:**
  Desenvolveu a primeira versão e as atualizações da lógica de pagamento, estruturou o layout principal do Front-end em React e construiu a parte inicial da Landing Page.

* **Fábio:**
  Realizou a atualização visual geral de toda a plataforma, padronizou a identidade visual e refatorou o fluxo de cadastro para uma experiência mais fluida e profissional.

* **Luiz:**
  Focou na configuração, alinhamento e ajustes dos ambientes de desenvolvimento (Back-end e Front-end) e garantiu a qualidade do sistema através da validação de funcionalidades e testes de integração.

* **Vinícius:**
  Assumiu a Landing Page, realizando todas as modificações estruturais e atualizações visuais para garantir um alto impacto na apresentação do negócio.

---

## Tecnologias Utilizadas

* **Front-end:** React, Vite, TailwindCSS
* **Back-end:** Node.js, Express
* **Banco de Dados:** MongoDB via Prisma ORM
* **Chat em tempo real:** Firebase Realtime Database (mensagens/histórico) + Socket.io (presença, "digitando…", notificações leves) — ver `docs/sprints/Sprint0-Firebase-Chat.md`
* **Integrações:** Abacate Pay (Pagamentos e Webhooks)

---

## Documentação adicional

* **`docs/DOCUMENTACAO-SESSAO.md`** — changelog detalhado de todas as sprints, correções e melhorias mais recentes (Solicitações, flag de pagamento, resiliência do chat, segurança).
* **`docs/sprints/Sprint0-Firebase-Chat.md`** — arquitetura do chat em tempo real.
* **`docs/testes/Regressao-Chat-Producao.md`** — checklist de testes de regressão do chat em produção.
* **`GUIA_DE_DEPLOY.md`** — passo a passo de deploy, incluindo a flag de pagamento (Sprint 6).
