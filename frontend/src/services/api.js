import axios from 'axios'
import { getIdToken } from './auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3002',
})

// Anexa o ID token do Firebase (renovado pelo SDK) em cada request protegido.
api.interceptors.request.use(async (config) => {
  const token = await getIdToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 (token inválido/expirado) ou 403 (e-mail não verificado / sem permissão):
// manda para o login, exceto quando já estamos na própria tela de login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const isLoginPage = window.location.pathname === '/login'
    if ((status === 401 || status === 403) && !isLoginPage) {
      window.location.assign('/login')
    }
    return Promise.reject(error)
  },
)

export default api
