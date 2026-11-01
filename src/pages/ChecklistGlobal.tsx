import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/ui'
import { SemSupabase, input } from '../components/forms'
import { STATUS_DOC } from './projeto/comum'

interface D {
  id: string; name: string; required: boolean; status: string; file_name: string | null
  project: { id: string; name: string; archived_at: string | null; client: { name: string } | null } | null
}
const RESOLVIDO = ['approved', 'waived']

export default function ChecklistGlobal() {
  const [lista, setLista] = useState<D[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState('pendentes')

  useEffect(() => {
    if (!supabase) return
    supabase.from('project_documents').select('id, name, required, status, file_name, project:projects(id, name, archived_at, client:clients(name))').limit(3000)
      .then(({ data }) => { setLista((data as unknown as D[]) ?? []); setCarregando(false) })
  }, [])

  const ativos = useMemo(() => lista.filter((d) => !d.project?.archived_at), [lista])

  const porProjeto = useMemo(() => {
    const mapa = new Map<string, { id: string; nome: string; docs: D[] }>()
    ativos.forEach((d) => {
      const id = d.project!.id
      if (!mapa.has(id)) mapa.set(id, { id, nome: d.project!.client?.name ?? d.project!.name, docs: [] })
      mapa.get(id)!.docs.push(d)
    })
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome))
  }, [ativos])

  if (!supabase) return <SemSupabase />

  const mostrar = (d: D) =>
    filtro === 'todos' ? true : filtro === 'pendentes' ? d.required && !RESOLVIDO.includes(d.status) : d.status === filtro

  return (
    <>
      <PageHeader title="Checklist Documental" subtitle="Situação dos documentos de todos os projetos" />
      <select className={`${input} mb-4 w-auto`} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
        <option value="pendentes">Obrigatórios ainda não aprovados</option>
        <option value="todos">Todos</option>
        {Object.entries(STATUS_DOC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <div className="space-y-4">
        {porProjeto.map((p) => {
          const obrig = p.docs.filter((d) => d.required)
          const ok = obrig.filter((d) => RESOLVIDO.includes(d.status)).length
          const itens = p.docs.filter(mostrar)
          if (itens.length === 0) return null
          return (
            <section key={p.id} className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <Link to={`/projetos/${p.id}`} className="text-sm font-semibold hover:underline">{p.nome}</Link>
                <span className="text-xs text-muted">{ok}/{obrig.length} obrigatórios aprovados</span>
              </div>
              <ul className="divide-y divide-line text-sm">
                {itens.map((d) => (
                  <li key={d.id} className="flex justify-between gap-3 py-2">
                    <span>{d.name}{d.file_name && <span className="ml-2 text-xs text-muted">({d.file_name})</span>}</span>
                    <span className="text-xs text-muted">{STATUS_DOC[d.status]}</span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        {!carregando && porProjeto.every((p) => p.docs.filter(mostrar).length === 0) && <div className="card p-10 text-center text-sm text-muted">Nada a exibir com este filtro.</div>}
        {carregando && <p className="text-sm text-muted">Carregando...</p>}
      </div>
    </>
  )
}
