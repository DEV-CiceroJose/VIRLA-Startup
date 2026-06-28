# Testes de Regressão em Produção — Chat (pós-Sprint 0)

> Substitui a antiga "Sprint 1 — Correção do Chat em Produção". A causa raiz
> (fragilidade do Socket.io como transporte das mensagens) já foi resolvida
> migrando o conteúdo do chat para o Firebase Realtime Database (Sprint 0).
> Este documento valida, em ambiente real hospedado, que a correção
> funciona — e cobre também a correção de resiliência feita depois (falha
> em cascata quando o Firebase não está configurado).

**Pré-requisito:** backend e frontend já publicados (Render, Vercel, etc.),
com as variáveis `FIREBASE_*` / `VITE_FIREBASE_*` configuradas conforme o
`docs/sprints/Sprint0-Firebase-Chat.md`.

**Como testar:** use dois dispositivos/navegadores diferentes (ou uma janela
normal + uma anônima) logados como dois usuários que podem conversar entre
si (um Familiar e um Cuidador, ou via uma Solicitação já visualizada).

---

## 1. Mensagens de texto em tempo real

- [ ] Usuário A envia uma mensagem de texto → aparece para o Usuário B
      **sem recarregar a página**, em menos de ~2 segundos.
- [ ] A mensagem aparece imediatamente para quem enviou (otimista), mesmo
      antes da confirmação do servidor.
- [ ] Enviar 5–10 mensagens em sequência rápida — nenhuma se perde, nenhuma
      duplica, ordem cronológica preservada.
- [ ] Recarregar a página do Usuário B no meio da conversa → o histórico
      completo aparece corretamente ordenado (lido do Firebase, não do
      Mongo).

## 2. Mensagens de áudio

- [ ] Gravar e enviar um áudio → aparece para o destinatário em tempo real,
      com player funcional.
- [ ] Áudio grande (próximo do limite `MAX_AUDIO_BYTES`) é aceito; acima do
      limite, dá erro claro (não trava a tela).

## 3. Sinais leves via Socket.io ("digitando…", presença, leitura)

- [ ] Usuário A começa a digitar → "digitando…" aparece para o Usuário B em
      tempo real.
- [ ] Parar de digitar por alguns segundos → indicador desaparece.
- [ ] Usuário B abre a conversa → mensagens de A são marcadas como lidas
      (ícone de "lido" atualiza para A).
- [ ] Indicador de online/offline reflete corretamente quando o outro
      usuário fecha o app/aba.

## 4. Reconexão e instabilidade de rede

- [ ] Com o chat aberto, desligar o Wi-Fi por ~10s e religar → o app
      reconecta sozinho, sem precisar recarregar a página, e sem a
      mensagem "Reconectando…" travada permanentemente.
- [ ] Trocar de rede no celular (Wi-Fi → 4G/5G) durante uma conversa ativa →
      mensagens continuam chegando depois da troca.
- [ ] Deixar o app em segundo plano (celular) por alguns minutos e voltar →
      mensagens enviadas nesse intervalo aparecem ao retornar.

## 5. Múltiplas abas/dispositivos do mesmo usuário

- [ ] Logar como o mesmo usuário em duas abas/dispositivos → enviar de uma
      reflete na outra (via `userChats` no RTDB).
- [ ] Marcar como lido em um dispositivo reflete no outro.

## 6. Resiliência quando o Firebase está mal configurado (correção recente)

> Objetivo: confirmar que um problema no Firebase **não derruba o backend
> inteiro** — só o chat fica indisponível.

- [ ] Em um ambiente de teste/staging, remover ou corromper temporariamente
      uma variável `FIREBASE_*` (ex.: `FIREBASE_PRIVATE_KEY`) e reiniciar o
      backend.
- [ ] Confirmar que o backend **sobe normalmente** (não há mais
      `process.exit(1)`).
- [ ] Confirmar que `GET /health` retorna `chat: "degraded"` mas o restante
      (`database`, `memory`) continua `"ok"`.
- [ ] Confirmar que **login, perfil, pagamentos e solicitações continuam
      funcionando** nesse cenário — só as rotas de chat retornam `503` com
      mensagem clara.
- [ ] Restaurar a variável correta, reiniciar, e confirmar que `chat`
      volta para `"ok"` em `/health` e o chat volta a funcionar.

## 7. Segurança das conversas (Security Rules)

- [ ] Usuário A **não consegue** ler/escrever mensagens de uma conversa da
      qual não faz parte (testar abrindo o DevTools e tentando chamar o
      SDK do Firebase diretamente para um `chatId` de outras duas pessoas —
      deve ser rejeitado pelas regras).
- [ ] Tentar editar o `content` de uma mensagem já existente (via SDK,
      manualmente) deve ser rejeitado — só o campo `read` pode mudar depois
      de criada, e só pelo destinatário.

## 8. CORS / ambiente hospedado

- [ ] Acessar o frontend pela URL de produção (não localhost) e confirmar
      que não há erros de CORS no console do navegador ao enviar mensagens.
- [ ] Testar em pelo menos 2 navegadores (Chrome + Safari, se possível,
      por causa de diferenças de WebSocket/iOS).

---

## Critério de conclusão

- [ ] Todos os itens acima passam em produção (ou staging com config
      idêntica) com dois usuários reais, sem precisar de F5 para receber
      mensagens.
- [ ] Nenhum item da seção 6 derruba o backend inteiro — apenas degrada o
      chat.
- [ ] Nenhuma mensagem duplicada ou fora de ordem observada durante os
      testes de carga leve (seção 1).

## Se algo falhar

| Sintoma | Onde olhar primeiro |
|---|---|
| Mensagens não chegam em tempo real | Console do navegador (erros do SDK Firebase) + Regras do RTDB no Console Firebase |
| "Digitando…"/presença não funciona, mas mensagens sim | Socket.io — ver CORS em `server.js` e logs do Render |
| Backend não sobe | Variáveis `FIREBASE_*` no `.env` do backend (formato do `\n` na `FIREBASE_PRIVATE_KEY`) |
| `chat: "degraded"` em `/health` mas devia estar ok | Logs do backend, evento `firebase:init_failed` ou `firebase:missing_env` |
| Erro 403/permission-denied no SDK do Firebase | Regras (`firebase.rules.json`) não publicadas no Console, ou Custom Token expirado |
