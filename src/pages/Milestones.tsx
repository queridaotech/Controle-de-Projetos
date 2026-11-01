import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { PageHeader } from '../components/ui'
import { SemSupabase, input } from '../components/forms'
import { formatarData } from '../lib/format'
import { STATUS_MARCO, hojeISO } from './projeto/comum'

interface M {
  id: string; title: string; planned_date: string | null; status: string
  project: { id: string; name: string; archived_at: string | null; client: { name: string } | null } | null
}

export default function Milestones() {
  const toast = useToast()
  const [lista, setLista] = useState<M[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ver, setVer] = useState('pendentes')

  const carregar = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.from('milestones').select('id, title, planned_date, status, project:projects(id, name, archived_at, client:clients(name))').order('planned_date', { nullsFirst: false })
    setLista((data as unknown as M[]) ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const hoje = hojeISO()
  const exibidos = useMemo(
    () => lista.filter((m) => !m.project?.archived_at).filter((m) => (ver === 'todos' ? true : ver === 'pendentes' ? m.status !== 'completed' : ver === 'atrasados' ? m.status !== 'completed' && m.planned_date != null && m.planned_date < hoje : m.status === 'completed')),
    [lista, ver, hoje],
  )

  if (!supabase) return <SemSupabase />

  async function alternar(m: M) {
    const { error } = await supabase!.from('milestones').update({ status: m.status === 'completed' ? 'pending' : 'completed' }).eq('id', m.id)
    if (error) toast.erro('Não foi possível atualizar.')
    carregar()
  }

  return (
    <>
      <PageHeader title="Milestones" subtitle="Marcos de todos os seus projetos, por data" />
      <div className="card p-5">
        <select className={`${input} mb-4 w-auto`} value={ver} onChange={(e) => setVer(e.target.value)}>
          <option value="pendentes">Pendentes</option>
          <option value="atrasados">Atrasados</option>
          <option value="concluidos">Concluídos</option>
          <option value="todos">Todos</option>
        </select>
        <ul className="divide-y divide-line text-sm">
          {exibidos.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <input type="checkbox" checked={m.status === 'completed'} onChange={() => alternar(m)} aria-label={`Concluir ${m.title}`} />
              <div className="min-w-0 flex-1">
                <p className={m.status === 'completed' ? 'text-muted line-through' : 'font-medium'}>{m.title}</p>
                <Link to={`/projetos/${m.project?.id}`} className="text-xs text-brand-600 hover:underline">{m.project?.client?.name ?? m.project?.name}</Link>
              </div>
              <span className={`text-xs ${m.status !== 'completed' && m.planned_date && m.planned_date < hoje ? 'text-red-600' : 'text-muted'}`}>{formatarData(m.planned_date)} · {STATUS_MARCO[m.status]}</span>
            </li>
          ))}
          {!carregando && exibidos.length === 0 && <li className="py-8 text-center text-muted">Nenhum milestone.</li>}
          {carregando && <li className="py-8 text-center text-muted">Carregando...</li>}
        </ul>
      </div>
    </>
  )
}
