import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

// Barreira de interface. A proteção real dos dados está no RLS do Supabase.
export function RotaProtegida() {
  const { carregando, perfil, session, demo } = useAuth()
  if (carregando) return <div className="flex h-full items-center justify-center text-sm text-muted">Carregando...</div>
  if (!demo && !session) return <Navigate to="/login" replace />
  if (!demo && perfil && !perfil.active) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
        Seu usuário está desativado. Fale com um administrador.
      </div>
    )
  }
  return <Outlet />
}

export function RotaAdmin() {
  const { ehAdmin } = useAuth()
  return ehAdmin ? <Outlet /> : <Navigate to="/" replace />
}
