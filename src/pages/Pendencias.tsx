import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { PageHeader } from '../components/ui'
import { SemSupabase, input } from '../components/forms'
import { formatarData } from '../lib/format'
import { PRIORIDADE, STATUS_PEND, hojeISO } from './projeto/comum'

interface Item {
  id: string; description: string; priority: string; status: string; due_date: string | null
  project: { id: string; name: string; archived_at: string | null; client: { name: string } | null } | null
  responsavel: { full_name: string } | null
}
const ABERTAS = ['open', 'in_progress', 'waiting_client', 'waiting_petrobras']

export default function Pendencias() {
  const toast = useToast()
  const [lista, setLista] = useState<Item[]>([])
  const [carregando, setCarregando] = useState(true)
  const [status, setStatus] = useState('abertas')
  const [prio, setPrio] = useState('')
  const [soAtrasadas, setSoAtrasadas] = useState(false)

  const carregar = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('project_pending_items')
      .select('id, description, priority, status, due_date, project:projects(id, name, archived_at, client:clients(name)), responsavel:profiles!project_pending_items_responsible_id_fkey(full_name)')
      .order('due_date', { nullsFirst: false })
    setLista((data as unknown as Item[]) ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const hoje = hojeISO()
  const exibidas = useMemo(
    () =>
      lista.filter((i) => !i.project?.archived_at)
        .filter((i) => (status === 'abertas' ? ABERTAS.includes(i.status) : status === 'todas' || i.status === status))
        .filter((i) => !prio || i.priority === prio)
        .filter((i) => !soAtrasadas || (ABERTAS.includes(i.status) && i.due_date != null && i.due_date < hoje)),
    [lista, status, prio, soAtrasadas, hoje],
  )

  if (!supabase) return <SemSupabase />

  async function resolver(i: Item) {
    const { error } = await supabase!.from('project_pending_items').update({ status: 'resolved' }).eq('id', i.id)
    if (error) toast.erro('Não foi possível resolver.')
    carregar()
  }

  return (
    <>
      <PageHeader title="Pendências" subtitle="Pendências de todos os seus projetos" />
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select className={`${input} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="abertas">Em aberto</option>
            <option value="todas">Todas</option>
            {Object.entries(STATUS_PEND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className={`${input} w-auto`} value={prio} onChange={(e) => setPrio(e.target.value)}>
            <option value="">Todas as prioridades</option>
            {Object.entries(PRIORIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={soAtrasadas} onChange={(e) => setSoAtrasadas(e.target.checked)} />Somente vencidas</label>
          <span className="ml-auto text-xs text-muted">{exibidas.length} resultado(s)</span>
        </div>
        <ul className="divide-y divide-line text-sm">
          {exibidas.map((i) => {
            const aberta = ABERTAS.includes(i.status)
            return (
              <li key={i.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className={aberta ? 'font-medium' : 'text-muted line-through'}>{i.description}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    <Link to={`/projetos/${i.project?.id}`} className="text-brand-600 hover:underline">{i.project?.client?.name ?? i.project?.name}</Link>
                    {' · '}{PRIORIDADE[i.priority]} · {STATUS_PEND[i.status]} · {i.responsavel?.full_name ?? 'Sem responsável'}
                  </p>
                </div>
                <span className={`text-xs ${aberta && i.due_date && i.due_date < hoje ? 'text-red-600' : 'text-muted'}`}>{formatarData(i.due_date)}</span>
                {aberta && <button onClick={() => resolver(i)} className="text-xs font-medium text-emerald-700 hover:underline">Resolver</button>}
              </li>
            )
          })}
          {!carregando && exibidas.length === 0 && <li className="py-8 text-center text-muted">Nenhuma pendência encontrada.</li>}
          {carregando && <li className="py-8 text-center text-muted">Carregando...</li>}
        </ul>
      </div>
    </>
  )
}
