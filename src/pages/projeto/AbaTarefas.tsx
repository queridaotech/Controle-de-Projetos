import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { Section } from '../../components/ui'
import { Modal, Confirmar } from '../../components/Modal'
import { BotaoPrimario, BotaoSecundario, Campo, input } from '../../components/forms'
import { formatarData } from '../../lib/format'
import { PRIORIDADE, STATUS_TAREFA, hojeISO, type AbaProps } from './comum'

interface Tarefa {
  id: string; title: string; description: string | null; stage_id: string | null; assigned_to: string | null
  start_date: string | null; due_date: string | null; priority: string; status: string
}
interface EtapaOp { id: string; position: number; name: string }

const vazio = { title: '', description: '', stage_id: '', assigned_to: '', start_date: '', due_date: '', priority: 'medium', status: 'todo' }

export default function AbaTarefas({ projetoId, equipe, recarregar }: AbaProps) {
  const toast = useToast()
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [etapas, setEtapas] = useState<EtapaOp[]>([])
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroResp, setFiltroResp] = useState('')
  const [edit, setEdit] = useState<Tarefa | 'nova' | null>(null)
  const [del, setDel] = useState<Tarefa | null>(null)
  const [form, setForm] = useState(vazio)

  const carregar = useCallback(async () => {
    const [t, e] = await Promise.all([
      supabase!.from('project_tasks').select('*').eq('project_id', projetoId).order('due_date', { nullsFirst: false }),
      supabase!.from('project_stages').select('id, position, name').eq('project_id', projetoId).order('position'),
    ])
    setTarefas((t.data as Tarefa[]) ?? [])
    setEtapas((e.data as EtapaOp[]) ?? [])
  }, [projetoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  function abrir(t: Tarefa | 'nova') {
    setForm(t === 'nova' ? vazio : {
      title: t.title, description: t.description ?? '', stage_id: t.stage_id ?? '', assigned_to: t.assigned_to ?? '',
      start_date: t.start_date ?? '', due_date: t.due_date ?? '', priority: t.priority, status: t.status,
    })
    setEdit(t)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return toast.erro('Informe o título da tarefa.')
    if (form.start_date && form.due_date && form.due_date < form.start_date) return toast.erro('O prazo não pode ser anterior ao início.')
    const dados = {
      title: form.title.trim(), description: form.description.trim() || null, stage_id: form.stage_id || null,
      assigned_to: form.assigned_to || null, start_date: form.start_date || null, due_date: form.due_date || null,
      priority: form.priority, status: form.status,
    }
    const { error } =
      edit === 'nova'
        ? await supabase!.from('project_tasks').insert({ ...dados, project_id: projetoId })
        : await supabase!.from('project_tasks').update(dados).eq('id', (edit as Tarefa).id)
    if (error) return toast.erro('Não foi possível salvar a tarefa.')
    toast.ok('Tarefa salva.')
    setEdit(null)
    carregar()
    recarregar()
  }

  async function mudarStatus(t: Tarefa, status: string) {
    const { error } = await supabase!.from('project_tasks').update({ status }).eq('id', t.id)
    if (error) toast.erro('Não foi possível atualizar.')
    carregar()
    recarregar()
  }

  async function excluir() {
    if (!del) return
    const { error } = await supabase!.from('project_tasks').delete().eq('id', del.id)
    if (error) toast.erro('Não foi possível excluir.')
    else toast.ok('Tarefa excluída.')
    setDel(null)
    carregar()
    recarregar()
  }

  const hoje = hojeISO()
  const lista = tarefas.filter((t) => (!filtroStatus || t.status === filtroStatus) && (!filtroResp || t.assigned_to === filtroResp))

  return (
    <Section title="Tarefas" action={<BotaoSecundario onClick={() => abrir('nova')}><Plus size={14} />Nova tarefa</BotaoSecundario>}>
      <div className="mb-4 flex flex-wrap gap-3">
        <select className={`${input} w-auto`} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_TAREFA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={`${input} w-auto`} value={filtroResp} onChange={(e) => setFiltroResp(e.target.value)}>
          <option value="">Todos os responsáveis</option>
          {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              {['Tarefa', 'Etapa', 'Responsável', 'Prazo', 'Prioridade', 'Status', ''].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {lista.map((t) => (
              <tr key={t.id} className="border-b border-line/60 hover:bg-surface">
                <td className="px-3 py-3"><button className={`text-left font-medium hover:underline ${t.status === 'done' ? 'text-muted line-through' : ''}`} onClick={() => abrir(t)}>{t.title}</button></td>
                <td className="px-3 py-3 text-muted">{etapas.find((e) => e.id === t.stage_id)?.position ?? '—'}</td>
                <td className="px-3 py-3">{equipe.find((p) => p.id === t.assigned_to)?.nome ?? '—'}</td>
                <td className={`px-3 py-3 ${t.status !== 'done' && t.due_date && t.due_date < hoje ? 'text-red-600' : ''}`}>{formatarData(t.due_date)}</td>
                <td className="px-3 py-3">{PRIORIDADE[t.priority]}</td>
                <td className="px-3 py-3">
                  <select value={t.status} onChange={(e) => mudarStatus(t, e.target.value)} className={`${input} w-auto py-1`} aria-label={`Status de ${t.title}`}>
                    {Object.entries(STATUS_TAREFA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="px-3 py-3 text-right"><button onClick={() => setDel(t)} className="rounded p-1.5 text-muted hover:text-red-600" title="Excluir"><Trash2 size={16} /></button></td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted">Nenhuma tarefa.</td></tr>}
          </tbody>
        </table>
      </div>

      {edit && (
        <Modal largo titulo={edit === 'nova' ? 'Nova tarefa' : 'Editar tarefa'} onClose={() => setEdit(null)}>
          <form onSubmit={salvar} className="space-y-4">
            <Campo rotulo="Título *"><input className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus /></Campo>
            <Campo rotulo="Descrição"><textarea rows={3} className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Etapa">
                <select className={input} value={form.stage_id} onChange={(e) => setForm({ ...form, stage_id: e.target.value })}>
                  <option value="">—</option>
                  {etapas.map((x) => <option key={x.id} value={x.id}>{x.position}. {x.name}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Responsável">
                <select className={input} value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                  <option value="">—</option>
                  {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Início"><input type="date" className={input} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Campo>
              <Campo rotulo="Prazo"><input type="date" className={input} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Campo>
              <Campo rotulo="Prioridade">
                <select className={input} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {Object.entries(PRIORIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Status">
                <select className={input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_TAREFA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
            </div>
            <div className="flex justify-end gap-2">
              <BotaoSecundario type="button" onClick={() => setEdit(null)}>Cancelar</BotaoSecundario>
              <BotaoPrimario>Salvar</BotaoPrimario>
            </div>
          </form>
        </Modal>
      )}
      {del && <Confirmar titulo="Excluir tarefa" texto={`Excluir "${del.title}"?`} onConfirm={excluir} onClose={() => setDel(null)} />}
    </Section>
  )
}
