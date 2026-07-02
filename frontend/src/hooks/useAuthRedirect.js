import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Redireciona para /login quando o Firebase termina de carregar e não há
 * usuário autenticado. Enquanto `loading` for true, não navega (evita mandar
 * para /login antes de o estado de auth estabilizar).
 *
 * @returns {{ userId: string | null; ready: boolean }}
 */
export function useAuthRedirect() {
  const navigate = useNavigate()
  const { firebaseUser, profile, loading } = useAuth()
  const ready = Boolean(firebaseUser && profile)

  useEffect(() => {
    if (!loading && !firebaseUser) navigate('/login')
  }, [loading, firebaseUser, navigate])

  return { userId: profile?.id ?? null, ready }
}
