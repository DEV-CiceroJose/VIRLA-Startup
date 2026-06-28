import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Redireciona para /login se não houver sessão.
 * @returns {{ userId: string | null; token: string | null; ready: boolean }}
 */
export function useAuthRedirect() {
  const navigate = useNavigate()
  const token = localStorage.getItem('meuToken')
  const userId = localStorage.getItem('meuId')
  const ready = Boolean(token && userId)

  useEffect(() => {
    if (!ready) navigate('/login')
  }, [ready, navigate])

  return { userId, token, ready }
}
