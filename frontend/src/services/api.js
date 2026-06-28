import axios from 'axios'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3002'
})

// Attach JWT for protected routes (messages, feed, profile, etc.)
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('meuToken')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Token expirado/inválido (401): limpa a sessão e manda pro login em vez de
// deixar o usuário preso vendo erros genéricos. Ignora 401 da própria tela de
// login (credenciais erradas), que deve mostrar a mensagem no formulário.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status
        const url = error.config?.url ?? ''
        const isLoginAttempt = url.includes('/auth/login')
        if (status === 401 && !isLoginAttempt) {
            localStorage.removeItem('meuToken')
            if (window.location.pathname !== '/login') {
                window.location.assign('/login')
            }
        }
        return Promise.reject(error)
    }
)

export default api
