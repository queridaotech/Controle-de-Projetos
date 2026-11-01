import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageHeader, Progress, StatusBadge } from '../components/ui'
import { SemSupabase } from '../components/forms'
import { STATUS_PROJETO } from '../lib/labels'

interface Linha {
  id: string
  full_name: string
  email: string
  active: boolean
  project_members: {
    member_role: string
    project: { id: string; name: string; status: string; progress: number; archived_at: string | null; client: { name: string } | null } | null
  }[]
}

export default function Consultores() {
  const [lista, setLista] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aberto, setAberto] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('profiles')
      .select(
        'id, full_name, email, active, project_members!project_members_user_id_fkey(member_role, project:projects(id, name, status, progress, archived_at, client:clients(name)))',
      )
      .order('full_name')
      .then(({ data }) => {
        setLista((data as unknown as Linha[]) ?? [])
        setCarregando(false)
      })
  }, [])

  if (!supabase) return <SemSupabase />

  return (
    <>
      <PageHeader title="Consultores" subtitle="Equipe e projetos alocados a cada pessoa" />
      <div className="card divide-y divide-line">
        {lista.map((c) => {
          const projetos = c.project_members.filter((m) => m.project && !m.project.archived_at)
          const ativos = projetos.filter((m) => !['completed', 'cancelled'].includes(m.project!.status)).length
          const aberta = aberto === c.id
          return (
            <div key={c.id}>
              <button onClick={() => setAberto(aberta ? null : c.id)} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-surface">
                {aberta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold uppercase text-brand-600">
                  {(c.full_name || c.email).charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.full_name || c.email}</p>
                  <p className="truncate text-xs text-muted">{c.email}{!c.active && ' · desativado'}</p>
                </div>
                <span className="text-sm text-muted">{ativos} ativo(s) · {projetos.length} no total</span>
              </button>
              {aberta && (
                <div className="bg-surface/60 px-5 py-3">
                  {projetos.length === 0 && <p className="py-2 text-sm text-muted">Nenhum projeto alocado.</p>}
                  {projetos.map((m) => (
                    <div key={m.project!.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                      <Link to={`/projetos/${m.project!.id}`} className="font-medium text-navy-900 hover:underline">
                        {m.project!.client?.name ?? m.project!.name}
                      </Link>
                      <span className="text-xs text-muted">{m.member_role === 'principal' ? 'Principal' : 'Auxiliar'}</span>
                      <StatusBadge status={STATUS_PROJETO[m.project!.status] ?? 'Em andamento'} />
                      <Progress value={Math.round(Number(m.project!.progress))} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {!carregando && lista.length === 0 && (
          <div className="p-10 text-center text-sm text-muted"><Users className="mx-auto mb-2 text-brand" />Nenhum usuário.</div>
        )}
        {carregando && <div className="p-10 text-center text-sm text-muted">Carregando...</div>}
      </div>
    </>
  )
}
