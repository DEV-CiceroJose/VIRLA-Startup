import { io } from 'socket.io-client';
import { getIdToken } from './auth';

// ─── 1. URL DA API ──────────────────────────────────────────────────
// Pega a URL da nuvem no Render, ou usa localhost se estiver a desenvolver localmente
const URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

// ─── 2. INSTÂNCIA DO SOCKET ─────────────────────────────────────────
export const socket = io(URL, {
  // ESSENCIAL: Garante que o cliente siga a mesma ordem de transporte do servidor
  transports: ['polling', 'websocket'],
  
  // Controle de Conexão
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1500,
  reconnectionDelayMax: 10000,
  
  // Segurança e CORS
  withCredentials: true, 
  
  // Autenticação Dinâmica
  auth: (cb) => {
    // Chamado a cada (re)conexão. Busca o ID token do Firebase (o SDK renova
    // automaticamente antes de expirar). O callback pode ser assíncrono.
    getIdToken()
      .then((token) => cb({ token }))
      .catch(() => cb({ token: null }));
  }
});