import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type Papel = 'admin' | 'consultant'

export interface Perfil {
  id: string
  full_name: string
  email: string
  role: Papel
  active: boolean
}

interface AuthState {
  carregando: boolean
  session: Session | null
  perfil: Perfil | null
  demo: boolean
  ehAdmin: boolean
  sair: () => Promise<void>
  atualizarPerfil: () => void
}

const Ctx = createContext<AuthState | null>(null)

const perfilDemo: Perfil = { id: 'demo', full_name: 'Modo demonstração', email: '', role: 'admin', active: true }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(Boolean(supabase))
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSession(s)
      if (!s) {
        setPerfil(null)
        setCarregando(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session) return
    if (versao === 0) setCarregando(true)
    supabase
      .from('profiles')
      .select('id, full_name, email, role, active')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setPerfil((data as Perfil) ?? null)
        setCarregando(false)
      })
  }, [session, versao])

  const demo = !supabase
  const atual = demo ? perfilDemo : perfil

  const value: AuthState = {
    carregando,
    session,
    perfil: atual,
    demo,
    ehAdmin: atual?.role === 'admin',
    atualizarPerfil: () => setVersao((v) => v + 1),
    sair: async () => {
      await supabase?.auth.signOut()
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return c
}
