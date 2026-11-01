import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { PageHeader } from '../components/ui'
import { Modal, Confirmar } from '../components/Modal'
import { BotaoPrimario, BotaoSecundario, Campo, SemSupabase, input } from '../components/forms'

interface Tipo { id: string; code: string; name: string }
interface Tarefa { id: string; stage_template_id: string; position: number; title: string; description: string | null }
interface Etapa {
  id: string; position: number; name: string; objective: string | null; milestone_title: string | null
  weight: number; required: boolean; active: boolean; stage_template_tasks: Tarefa[]
}
interface Doc { id: string; position: number; name: string; category: string | null; required: boolean; active: boolean }

type Edicao =
  | { tipo: 'etapa'; item: Etapa }
  | { tipo: 'tarefa'; etapa: Etapa; item: Tarefa | null }
  | { tipo: 'doc'; item: Doc | null }

export default function Modelos() {
  const toast = useToast()
  const [tipos, setTipos] = useState<Tipo[]>([])
  const [tipoId, setTipoId] = useState('')
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [aberta, setAberta] = useState<string | null>(null)
  const [ed, setEd] = useState<Edicao | null>(null)
  const [del, setDel] = useState<{ tabela: string; id: string; nome: string } | null>(null)
  const [f, setF] = useState<Record<string, string | boolean>>({})

  useEffect(() => {
    if (!supabase) return
    supabase.from('project_types').select('id, code, name').eq('active', true).order('name').then(({ data }) => {
      setTipos((data as Tipo[]) ?? [])
      setTipoId((data as Tipo[])?.[0]?.id ?? '')
    })
  }, [])

  const carregar = useCallback(async () => {
    if (!supabase || !tipoId) return
    const [e, d] = await Promise.all([
      supabase.from('stage_templates').select('*, stage_template_tasks(*)').eq('project_type_id', tipoId).order('position'),
      supabase.from('document_checklists').select('*').eq('project_type_id', tipoId).order('position'),
    ])
    const lista = ((e.data as Etapa[]) ?? []).map((x) => ({ ...x, stage_template_tasks: [...x.stage_template_tasks].sort((a, b) => a.position - b.position) }))
    setEtapas(lista)
    setDocs((d.data as Doc[]) ?? [])
  }, [tipoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (!supabase) return <SemSupabase />

  function abrir(x: Edicao) {
    if (x.tipo === 'etapa') setF({ name: x.item.name, objective: x.item.objective ?? '', milestone_title: x.item.milestone_title ?? '', weight: String(x.item.weight), required: x.item.required, active: x.item.active })
    if (x.tipo === 'tarefa') setF({ title: x.item?.title ?? '', description: x.item?.description ?? '' })
    if (x.tipo === 'doc') setF({ name: x.item?.name ?? '', category: x.item?.category ?? '', required: x.item?.required ?? true, active: x.item?.active ?? true })
    setEd(x)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!ed) return
    let error: { message: string } | null = null
    if (ed.tipo === 'etapa') {
      const peso = Number(f.weight)
      if (!String(f.name).trim()) return toast.erro('Informe o nome da etapa.')
      if (!(peso >= 0)) return toast.erro('Peso inválido.')
      ;({ error } = await supabase!.from('stage_templates').update({
        name: String(f.name).trim(), objective: String(f.objective).trim() || null,
        milestone_title: String(f.milestone_title).trim() || null, weight: peso, required: Boolean(f.required), active: Boolean(f.active),
      }).eq('id', ed.item.id))
    } else if (ed.tipo === 'tarefa') {
      if (!String(f.title).trim()) return toast.erro('Informe o título da tarefa.')
      const dados = { title: String(f.title).trim(), description: String(f.description).trim() || null }
      if (ed.item) ({ error } = await supabase!.from('stage_template_tasks').update(dados).eq('id', ed.item.id))
      else {
        const prox = Math.max(0, ...ed.etapa.stage_template_tasks.map((t) => t.position)) + 1
        ;({ error } = await supabase!.from('stage_template_tasks').insert({ ...dados, stage_template_id: ed.etapa.id, position: prox }))
      }
    } else {
      if (!String(f.name).trim()) return toast.erro('Informe o nome do documento.')
      const dados = { name: String(f.name).trim(), category: String(f.category).trim() || null, required: Boolean(f.required), active: Boolean(f.active) }
      if (ed.item) ({ error } = await supabase!.from('document_checklists').update(dados).eq('id', ed.item.id))
      else {
        const prox = Math.max(0, ...docs.map((d) => d.position)) + 1
        ;({ error } = await supabase!.from('document_checklists').insert({ ...dados, project_type_id: tipoId, position: prox }))
      }
    }
    if (error) return toast.erro('Não foi possível salvar.')
    toast.ok('Modelo atualizado. Vale para projetos criados a partir de agora.')
    setEd(null)
    carregar()
  }

  async function excluir() {
    if (!del) return
    const { error } = await supabase!.from(del.tabela).delete().eq('id', del.id)
    if (error) toast.erro('Não foi possível excluir.')
    else toast.ok('Item excluído.')
    setDel(null)
    carregar()
  }

  const soma = etapas.filter((e) => e.active).reduce((a, e) => a + Number(e.weight), 0)

  return (
    <>
      <PageHeader title="Modelos de Projetos" subtitle="Etapas, tarefas e documentos copiados para cada novo projeto" />
      <p className="mb-4 rounded-lg bg-brand-50 p-3 text-xs text-brand-600">
        Alterações aqui valem apenas para projetos criados depois. Projetos existentes mantêm a sua própria cópia do roadmap.
      </p>

      {tipos.length > 1 && (
        <select className={`${input} mb-4 w-auto`} value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
          {tipos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}

      <div className="card mb-5 divide-y divide-line">
        <div className="flex items-center justify-between px-5 py-3 text-sm">
          <span className="font-semibold">Etapas do roadmap</span>
          <span className={`text-xs ${Math.abs(soma - 100) > 0.01 ? 'text-amber-600' : 'text-muted'}`}>Soma dos pesos ativos: {soma}{Math.abs(soma - 100) > 0.01 && ' (o ideal é 100)'}</span>
        </div>
        {etapas.map((e) => (
          <div key={e.id}>
            <div className="flex items-center gap-3 px-5 py-3 text-sm">
              <button onClick={() => setAberta(aberta === e.id ? null : e.id)} className="text-muted" aria-label="Expandir">
                {aberta === e.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <span className={`min-w-0 flex-1 ${e.active ? 'font-medium' : 'text-muted line-through'}`}>{e.position}. {e.name}</span>
              <span className="text-xs text-muted">peso {Number(e.weight)} · {e.stage_template_tasks.length} tarefa(s)</span>
              <button onClick={() => abrir({ tipo: 'etapa', item: e })} className="rounded p-1.5 text-muted hover:bg-line/50" title="Editar etapa"><Pencil size={15} /></button>
            </div>
            {aberta === e.id && (
              <div className="bg-surface/60 px-5 py-3 pl-12">
                {e.milestone_title && <p className="mb-2 text-xs text-muted">Milestone: {e.milestone_title}</p>}
                <ul className="divide-y divide-line text-sm">
                  {e.stage_template_tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 py-2">
                      <span className="flex-1">{t.title}</span>
                      <button onClick={() => abrir({ tipo: 'tarefa', etapa: e, item: t })} className="rounded p-1 text-muted hover:bg-line/50" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => setDel({ tabela: 'stage_template_tasks', id: t.id, nome: t.title })} className="rounded p-1 text-muted hover:text-red-600" title="Excluir"><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2"><BotaoSecundario onClick={() => abrir({ tipo: 'tarefa', etapa: e, item: null })}><Plus size={14} />Tarefa</BotaoSecundario></div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card divide-y divide-line">
        <div className="flex items-center justify-between px-5 py-3 text-sm">
          <span className="font-semibold">Checklist documental</span>
          <BotaoSecundario onClick={() => abrir({ tipo: 'doc', item: null })}><Plus size={14} />Documento</BotaoSecundario>
        </div>
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-5 py-3 text-sm">
            <span className={`min-w-0 flex-1 ${d.active ? '' : 'text-muted line-through'}`}>
              {d.position}. {d.name}{!d.required && <span className="ml-2 text-xs text-muted">(opcional)</span>}
              {d.category && <span className="block text-xs text-muted">{d.category}</span>}
            </span>
            <button onClick={() => abrir({ tipo: 'doc', item: d })} className="rounded p-1.5 text-muted hover:bg-line/50" title="Editar"><Pencil size={15} /></button>
            <button onClick={() => setDel({ tabela: 'document_checklists', id: d.id, nome: d.name })} className="rounded p-1.5 text-muted hover:text-red-600" title="Excluir"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      {ed && (
        <Modal titulo={ed.tipo === 'etapa' ? `Etapa ${ed.item.position}` : ed.tipo === 'tarefa' ? (ed.item ? 'Editar tarefa' : 'Nova tarefa') : (ed.item ? 'Editar documento' : 'Novo documento')} onClose={() => setEd(null)}>
          <form onSubmit={salvar} className="space-y-4">
            {ed.tipo === 'etapa' && (
              <>
                <Campo rotulo="Nome *"><input className={input} value={String(f.name)} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Campo>
                <Campo rotulo="Objetivo"><textarea rows={2} className={input} value={String(f.objective)} onChange={(e) => setF({ ...f, objective: e.target.value })} /></Campo>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo rotulo="Milestone da etapa"><input className={input} value={String(f.milestone_title)} onChange={(e) => setF({ ...f, milestone_title: e.target.value })} /></Campo>
                  <Campo rotulo="Peso no progresso"><input type="number" min={0} step="0.5" className={input} value={String(f.weight)} onChange={(e) => setF({ ...f, weight: e.target.value })} /></Campo>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(f.required)} onChange={(e) => setF({ ...f, required: e.target.checked })} />Etapa obrigatória para concluir o CRC</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(f.active)} onChange={(e) => setF({ ...f, active: e.target.checked })} />Etapa ativa no modelo</label>
              </>
            )}
            {ed.tipo === 'tarefa' && (
              <>
                <Campo rotulo="Título *"><input className={input} value={String(f.title)} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></Campo>
                <Campo rotulo="Descrição"><textarea rows={3} className={input} value={String(f.description)} onChange={(e) => setF({ ...f, description: e.target.value })} /></Campo>
              </>
            )}
            {ed.tipo === 'doc' && (
              <>
                <Campo rotulo="Nome *"><input className={input} value={String(f.name)} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Campo>
                <Campo rotulo="Categoria"><input className={input} value={String(f.category)} onChange={(e) => setF({ ...f, category: e.target.value })} /></Campo>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(f.required)} onChange={(e) => setF({ ...f, required: e.target.checked })} />Obrigatório</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(f.active)} onChange={(e) => setF({ ...f, active: e.target.checked })} />Ativo no modelo</label>
              </>
            )}
            <div className="flex justify-end gap-2">
              <BotaoSecundario type="button" onClick={() => setEd(null)}>Cancelar</BotaoSecundario>
              <BotaoPrimario>Salvar</BotaoPrimario>
            </div>
          </form>
        </Modal>
      )}
      {del && <Confirmar titulo="Excluir do modelo" texto={`Excluir "${del.nome}" do modelo? Projetos existentes não são afetados.`} onConfirm={excluir} onClose={() => setDel(null)} />}
    </>
  )
}
