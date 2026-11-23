# Teste local completo

Este modo usa Firebase Auth, Firestore e Realtime Database em emuladores locais. Nenhum dado é enviado ao projeto Firebase de produção.

## Serviços

- Interface: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3003`
- Painel dos emuladores: `http://127.0.0.1:4000`

## Contas locais

- Familiar: `familiar.teste@virla.local`
- Cuidador: `cuidador.teste@virla.local`
- Senha comum: `VirlaTeste#2026`

As contas são criadas com e-mail confirmado e dados fictícios. O seed também adiciona perfis auxiliares, sete solicitações abertas com diferentes compatibilidades e dois relatórios de atendimento fictícios para validar o resumo financeiro do cuidador.

## Como iniciar novamente

O Firebase Emulator requer Java 21 ou superior. Com as variáveis abaixo configuradas:

1. Em `backend`, execute `pnpm dlx firebase-tools emulators:start --only auth,firestore,database --project virla-startap`.
2. Em outro terminal de `backend`, execute `pnpm seed:test` e depois `node server.js`.
3. Em `frontend`, execute `node node_modules/vite/bin/vite.js --host 127.0.0.1`.

Os dados são locais e temporários. Depois que os emuladores forem encerrados, execute o seed novamente na próxima inicialização.

## Variáveis necessárias

Backend:

```text
NODE_ENV=development
PORT=3003
FRONTEND_URL=http://127.0.0.1:5173
FIREBASE_PROJECT_ID=virla-startap
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000
FIREBASE_DATABASE_URL=http://127.0.0.1:9000/?ns=virla-startap-default-rtdb
ENCRYPTION_KEY=chave-de-exatos-32-caracteres!!!
```

Frontend:

```text
VITE_API_URL=http://127.0.0.1:3003
VITE_USE_FIREBASE_EMULATORS=true
VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
VITE_FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1
VITE_FIREBASE_DATABASE_EMULATOR_PORT=9000
```
