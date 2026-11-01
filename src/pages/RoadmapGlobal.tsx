import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { supabase } from '../lib/supabase'
import { PageHeader, Progress } from '../components/ui'
import { SemSupabase } from '../components/forms'
import { ETAPAS } from '../lib/data'
import { STATUS_ETAPA } from '../lib/labels'

interface P {
  id: string; name: string; progress: number; archived_at: string | null; status: string
  client: { name: string } | null
  project_stages: { position: number; status: string; name: string }[]
}

const COR: Record<string, string> = {
  completed: 'bg-emerald-500', in_progress: 'bg-brand', blocked: 'bg-red-500', not_started: 'bg-line',
}

export default function RoadmapGlobal() {
  const [lista, setLista] = useState<P[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!supabase) return
    supabase.from('projects').select('id, name, progress, archived_at, status, client:clients(name), project_stages(position, status, name)').order('created_at', { ascending: false })
      .then(({ data }) => { setLista(((data as unknown as P[]) ?? []).filter((p) => !p.archived_at)); setCarregando(false) })
  }, [])

  if (!supabase) return <SemSupabase />

  return (
    <>
      <PageHeader title="Roadmap CRC Petrobras" subtitle="Posição de cada projeto nas 8 etapas" />
      <div className="card overflow-x-auto p-5">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="pb-3 font-medium">Cliente</th>
              {ETAPAS.map((e, i) => <th key={e} className="px-1 pb-3 text-center font-medium" title={e}>{i + 1}</th>)}
              <th className="pb-3 pl-3 font-medium">Progresso</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const ordenadas = [...p.project_stages].sort((a, b) => a.position - b.position)
              return (
                <tr key={p.id} className="border-t border-line">
                  <td className="py-3 pr-3"><Link to={`/projetos/${p.id}`} className="font-medium hover:underline">{p.client?.name ?? p.name}</Link></td>
                  {ordenadas.map((s) => (
                    <td key={s.position} className="px-1 py-3">
                      <div className={clsx('mx-auto h-3 w-full min-w-6 rounded', COR[s.status])} title={`${s.position}. ${s.name} — ${STATUS_ETAPA[s.status]}`} />
                    </td>
                  ))}
                  <td className="py-3 pl-3"><Progress value={Math.round(Number(p.progress))} /></td>
                </tr>
              )
            })}
            {!carregando && lista.length === 0 && <tr><td colSpan={10} className="py-10 text-center text-muted">Nenhum projeto.</td></tr>}
            {carregando && <tr><td colSpan={10} className="py-10 text-center text-muted">Carregando...</td></tr>}
          </tbody>
        </table>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
          {Object.entries(COR).map(([k, c]) => <span key={k} className="flex items-center gap-1.5"><span className={clsx('h-3 w-3 rounded', c)} />{STATUS_ETAPA[k]}</span>)}
        </div>
        <ol className="mt-4 grid gap-1 text-xs text-muted sm:grid-cols-2">{ETAPAS.map((e, i) => <li key={e}>{i + 1}. {e}</li>)}</ol>
      </div>
    </>
  )
}
