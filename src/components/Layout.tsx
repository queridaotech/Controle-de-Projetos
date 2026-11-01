import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderKanban, User, AlertTriangle, CheckCircle2, Map, FileCheck2,
  ListChecks, Activity, Flag, Users, Briefcase, Building2, Package, Copy, Settings,
  Bell, BarChart3, UserCircle, Search, LogOut, Menu,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import clsx from 'clsx'
import { useAuth } from '../lib/auth'

const grupos = [
  { titulo: 'Visão geral', itens: [{ to: '/', label: 'Dashboard Executivo', icon: LayoutDashboard }] },
  {
    titulo: 'Projetos',
    itens: [
      { to: '/projetos', label: 'Todos os Projetos', icon: FolderKanban },
      { to: '/meus-projetos', label: 'Meus Projetos', icon: User },
      { to: '/projetos-atrasados', label: 'Projetos em Atraso', icon: AlertTriangle },
      { to: '/projetos-concluidos', label: 'Projetos Concluídos', icon: CheckCircle2 },
    ],
  },
  {
    titulo: 'Gestão Operacional',
    itens: [
      { to: '/roadmap', label: 'Roadmap CRC Petrobras', icon: Map },
      { to: '/checklist', label: 'Checklist Documental', icon: FileCheck2 },
      { to: '/pendencias', label: 'Pendências', icon: ListChecks },
      { to: '/atividades', label: 'Atividades', icon: Activity },
      { to: '/milestones', label: 'Milestones', icon: Flag },
    ],
  },
  {
    titulo: 'Administração',
    itens: [
      { to: '/usuarios', label: 'Usuários', icon: Users },
      { to: '/consultores', label: 'Consultores', icon: Briefcase },
      { to: '/clientes', label: 'Clientes', icon: Building2 },
      { to: '/linhas', label: 'Linhas de Fornecimento', icon: Package },
      { to: '/modelos', label: 'Modelos de Projetos', icon: Copy },
      { to: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
  {
    titulo: 'Outros',
    itens: [
      { to: '/notificacoes', label: 'Notificações', icon: Bell },
      { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
      { to: '/perfil', label: 'Meu Perfil', icon: UserCircle },
    ],
  },
]

export default function Layout() {
  const [aberto, setAberto] = useState(false)
  const nav = useNavigate()
  const { perfil, ehAdmin, sair, demo } = useAuth()
  const [busca, setBusca] = useState('')
  const [naoLidas, setNaoLidas] = useState(0)
  useEffect(() => {
    if (!supabase || demo || !perfil) return
    const ler = () =>
      supabase!.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
        .then(({ count }) => setNaoLidas(count ?? 0))
    ler()
    const t = setInterval(ler, 60000)
    window.addEventListener('notificacoes-atualizadas', ler)
    return () => { clearInterval(t); window.removeEventListener('notificacoes-atualizadas', ler) }
  }, [perfil, demo])
  const visiveis = grupos.filter((g) => ehAdmin || g.titulo !== 'Administração')
  const nome = perfil?.full_name || perfil?.email || 'Usuário'

  async function aoSair() {
    await sair()
    nav('/login')
  }

  return (
    <div className="flex h-full">
      {aberto && <div className="fixed inset-0 z-30 bg-navy-950/50 lg:hidden" onClick={() => setAberto(false)} />}

      <aside
        className={clsx(
          'fixed z-40 flex h-full w-64 shrink-0 flex-col bg-navy-950 text-white transition-transform lg:static lg:translate-x-0',
          aberto ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <img src="/logo-branco.png" alt="Petrosupply" className="h-7 w-auto" />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {visiveis.map((g) => (
            <div key={g.titulo} className="mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">{g.titulo}</p>
              {g.itens.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setAberto(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive ? 'bg-brand font-medium text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
                    )
                  }
                >
                  <Icon size={17} strokeWidth={1.8} />
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-3 border-t border-white/10 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold uppercase">
            {nome.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{nome}</p>
            <p className="text-xs text-white/50">{demo ? 'Demonstração' : ehAdmin ? 'Administrador' : 'Consultor'}</p>
          </div>
          <button onClick={aoSair} title="Sair" className="text-white/60 hover:text-white">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white px-4 lg:px-8">
          <button className="lg:hidden" onClick={() => setAberto(true)} aria-label="Abrir menu">
            <Menu size={22} />
          </button>
          <form
            className="relative max-w-md flex-1"
            onSubmit={(e) => { e.preventDefault(); nav(`/projetos${busca.trim() ? `?q=${encodeURIComponent(busca.trim())}` : ''}`) }}
          >
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar projetos e clientes..."
              className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
            />
          </form>
          <button onClick={() => nav('/notificacoes')} className="relative ml-auto rounded-lg p-2 text-muted hover:bg-surface">
            <Bell size={19} />
            {naoLidas > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                {naoLidas > 9 ? '9+' : naoLidas}
              </span>
            )}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
