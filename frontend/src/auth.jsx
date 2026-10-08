import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setMe(await api('GET', '/me'))
    } catch {
      setMe(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const register = async (body) => { const d = await api('POST', '/auth/register', body); setMe(d); return d }
  const login = async (body) => { const d = await api('POST', '/auth/login', body); setMe(d); return d }
  const logout = async () => { await api('POST', '/auth/logout'); setMe(null) }
  const updateMe = async (body) => { const d = await api('PATCH', '/me', body); setMe(d); return d }

  return (
    <AuthCtx.Provider value={{ me, loading, register, login, logout, updateMe, refresh }}>
      {children}
    </AuthCtx.Provider>
  )
}
