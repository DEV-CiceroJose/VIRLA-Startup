import { io } from 'socket.io-client';

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
    // É chamado a cada (re)conexão para garantir que o token não está expirado
    const token = localStorage.getItem('meuToken');
    cb({ token });
  }
});