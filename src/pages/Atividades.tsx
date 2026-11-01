import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { PageHeader } from '../components/ui'
import { SemSupabase, input } from '../components/forms'
import { formatarData } from '../lib/format'
import { PRIORIDADE, STATUS_TAREFA, hojeISO } from './projeto/comum'

interface T {
  id: string; title: string; status: string; priority: string; due_date: string | null; assigned_to: string | null
  project: { id: string; name: string; archived_at: string | null; client: { name: string } | null } | null
  responsavel: { full_name: string } | null
}

export default function Atividades() {
  const { perfil } = useAuth()
  const toast = useToast()
  const [lista, setLista] = useState<T[]>([])
  const [carregando, setCarregando] = useState(true)
  const [quem, setQuem] = useState('minhas')
  const [status, setStatus] = useState('abertas')

  const carregar = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('project_tasks')
      .select('id, title, status, priority, due_date, assigned_to, project:projects(id, name, archived_at, client:clients(name)), responsavel:profiles!project_tasks_assigned_to_fkey(full_name)')
      .order('due_date', { nullsFirst: false })
      .limit(1000)
    setLista((data as unknown as T[]) ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const hoje = hojeISO()
  const exibidas = useMemo(
    () => lista.filter((t) => !t.project?.archived_at)
      .filter((t) => quem === 'todas' || t.assigned_to === perfil?.id)
      .filter((t) => (status === 'abertas' ? t.status !== 'done' : status === 'vencidas' ? t.status !== 'done' && t.due_date != null && t.due_date < hoje : status === 'todas' || t.status === status)),
    [lista, quem, status, perfil, hoje],
  )

  if (!supabase) return <SemSupabase />

  async function mudar(t: T, novo: string) {
    const { error } = await supabase!.from('project_tasks').update({ status: novo }).eq('id', t.id)
    if (error) toast.erro('Não foi possível atualizar.')
    carregar()
  }

  return (
    <>
      <PageHeader title="Atividades" subtitle="Tarefas de todos os seus projetos" />
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select className={`${input} w-auto`} value={quem} onChange={(e) => setQuem(e.target.value)}>
            <option value="minhas">Atribuídas a mim</option>
            <option value="todas">Todas</option>
          </select>
          <select className={`${input} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="abertas">Em aberto</option>
            <option value="vencidas">Vencidas</option>
            <option value="todas">Todas</option>
            {Object.entries(STATUS_TAREFA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <span className="ml-auto text-xs text-muted">{exibidas.length} tarefa(s)</span>
        </div>
        <ul className="divide-y divide-line text-sm">
          {exibidas.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className={t.status === 'done' ? 'text-muted line-through' : 'font-medium'}>{t.title}</p>
                <p className="text-xs text-muted">
                  <Link to={`/projetos/${t.project?.id}`} className="text-brand-600 hover:underline">{t.project?.client?.name ?? t.project?.name}</Link>
                  {' · '}{PRIORIDADE[t.priority]} · {t.responsavel?.full_name ?? 'Sem responsável'}
                </p>
              </div>
              <span className={`text-xs ${t.status !== 'done' && t.due_date && t.due_date < hoje ? 'text-red-600' : 'text-muted'}`}>{formatarData(t.due_date)}</span>
              <select value={t.status} onChange={(e) => mudar(t, e.target.value)} className={`${input} w-auto py-1`} aria-label={`Status de ${t.title}`}>
                {Object.entries(STATUS_TAREFA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </li>
          ))}
          {!carregando && exibidas.length === 0 && <li className="py-8 text-center text-muted">Nenhuma tarefa encontrada.</li>}
          {carregando && <li className="py-8 text-center text-muted">Carregando...</li>}
        </ul>
      </div>
    </>
  )
}
