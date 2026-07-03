import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { onAuthChange } from '../services/auth'
import api from '../services/api'

const AuthContext = createContext(null)

function syncLocalStorage(profile) {
  if (profile) {
    localStorage.setItem('meuId', profile.id)
    if (profile.name) localStorage.setItem('meuNome', profile.name)
    if (profile.role) localStorage.setItem('meuRole', profile.role)
  } else {
    localStorage.removeItem('meuId')
    localStorage.removeItem('meuNome')
    localStorage.removeItem('meuRole')
  }
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/users/me')
      setProfile(data.user)
      syncLocalStorage(data.user)
      return data.user
    } catch (err) {
      if (err.response?.status === 404) {
        setProfile(null)
        syncLocalStorage(null)
        return null
      }
      throw err
    }
  }, [])

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      setFirebaseUser(user)
      if (!user) {
        setProfile(null)
        syncLocalStorage(null)
        setLoading(false)
        return
      }
      try {
        await refreshProfile()
      } catch {
        /* deixa profile como está; erro transitório */
      } finally {
        setLoading(false)
      }
    })
    return unsub
  }, [refreshProfile])

  const value = {
    firebaseUser,
    profile,
    emailVerified: firebaseUser?.emailVerified === true,
    needsProfile: Boolean(firebaseUser) && profile === null,
    loading,
    refreshProfile,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
