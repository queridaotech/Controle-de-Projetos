import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { Section } from '../../components/ui'
import { Modal, Confirmar } from '../../components/Modal'
import { BotaoPrimario, BotaoSecundario, Campo, input } from '../../components/forms'
import { formatarData } from '../../lib/format'
import { PRIORIDADE, STATUS_PEND, hojeISO, type AbaProps } from './comum'

interface Pend {
  id: string; description: string; responsible_id: string | null; identified_at: string; due_date: string | null
  priority: string; status: string; action_plan: string | null; stage_id: string | null
}

const vazio = { description: '', responsible_id: '', due_date: '', priority: 'medium', status: 'open', action_plan: '' }
const ABERTAS = ['open', 'in_progress', 'waiting_client', 'waiting_petrobras']

export default function AbaPendencias({ projetoId, equipe, recarregar }: AbaProps) {
  const toast = useToast()
  const [lista, setLista] = useState<Pend[]>([])
  const [ver, setVer] = useState<'abertas' | 'todas'>('abertas')
  const [edit, setEdit] = useState<Pend | 'nova' | null>(null)
  const [del, setDel] = useState<Pend | null>(null)
  const [form, setForm] = useState(vazio)

  const carregar = useCallback(async () => {
    const { data } = await supabase!.from('project_pending_items').select('*').eq('project_id', projetoId).order('due_date', { nullsFirst: false })
    setLista((data as Pend[]) ?? [])
  }, [projetoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  function abrir(p: Pend | 'nova') {
    setForm(p === 'nova' ? vazio : {
      description: p.description, responsible_id: p.responsible_id ?? '', due_date: p.due_date ?? '',
      priority: p.priority, status: p.status, action_plan: p.action_plan ?? '',
    })
    setEdit(p)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim()) return toast.erro('Descreva a pendência.')
    const dados = {
      description: form.description.trim(), responsible_id: form.responsible_id || null, due_date: form.due_date || null,
      priority: form.priority, status: form.status, action_plan: form.action_plan.trim() || null,
    }
    const { error } =
      edit === 'nova'
        ? await supabase!.from('project_pending_items').insert({ ...dados, project_id: projetoId })
        : await supabase!.from('project_pending_items').update(dados).eq('id', (edit as Pend).id)
    if (error) return toast.erro('Não foi possível salvar a pendência.')
    toast.ok('Pendência salva.')
    setEdit(null)
    carregar()
    recarregar()
  }

  async function resolver(p: Pend) {
    const { error } = await supabase!.from('project_pending_items').update({ status: 'resolved' }).eq('id', p.id)
    if (error) toast.erro('Não foi possível resolver.')
    carregar()
    recarregar()
  }

  async function excluir() {
    if (!del) return
    const { error } = await supabase!.from('project_pending_items').delete().eq('id', del.id)
    if (error) toast.erro('Não foi possível excluir.')
    else toast.ok('Pendência excluída.')
    setDel(null)
    carregar()
    recarregar()
  }

  const hoje = hojeISO()
  const exibidas = lista.filter((p) => ver === 'todas' || ABERTAS.includes(p.status))

  return (
    <Section
      title="Pendências"
      action={
        <div className="flex items-center gap-2">
          <select className={`${input} w-auto py-1`} value={ver} onChange={(e) => setVer(e.target.value as 'abertas' | 'todas')}>
            <option value="abertas">Em aberto</option>
            <option value="todas">Todas</option>
          </select>
          <BotaoSecundario onClick={() => abrir('nova')}><Plus size={14} />Nova</BotaoSecundario>
        </div>
      }
    >
      {exibidas.length === 0 ? <p className="text-sm text-muted">Nenhuma pendência.</p> : (
        <ul className="divide-y divide-line">
          {exibidas.map((p) => {
            const aberta = ABERTAS.includes(p.status)
            return (
              <li key={p.id} className="flex flex-wrap items-start gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <button onClick={() => abrir(p)} className={`text-left font-medium hover:underline ${aberta ? '' : 'text-muted line-through'}`}>{p.description}</button>
                  <p className="mt-0.5 text-xs text-muted">
                    {PRIORIDADE[p.priority]} · {STATUS_PEND[p.status]} · {equipe.find((x) => x.id === p.responsible_id)?.nome ?? 'Sem responsável'}
                    {p.action_plan && ` · Plano: ${p.action_plan}`}
                  </p>
                </div>
                <span className={`text-xs ${aberta && p.due_date && p.due_date < hoje ? 'text-red-600' : 'text-muted'}`}>{formatarData(p.due_date)}</span>
                {aberta && <button onClick={() => resolver(p)} className="text-xs font-medium text-emerald-700 hover:underline">Resolver</button>}
                <button onClick={() => setDel(p)} className="rounded p-1 text-muted hover:text-red-600" title="Excluir"><Trash2 size={14} /></button>
              </li>
            )
          })}
        </ul>
      )}

      {edit && (
        <Modal titulo={edit === 'nova' ? 'Nova pendência' : 'Editar pendência'} onClose={() => setEdit(null)}>
          <form onSubmit={salvar} className="space-y-4">
            <Campo rotulo="Descrição *"><textarea rows={3} className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} autoFocus /></Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Responsável">
                <select className={input} value={form.responsible_id} onChange={(e) => setForm({ ...form, responsible_id: e.target.value })}>
                  <option value="">—</option>
                  {equipe.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Prazo"><input type="date" className={input} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Campo>
              <Campo rotulo="Prioridade">
                <select className={input} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {Object.entries(PRIORIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Status">
                <select className={input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_PEND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
            </div>
            <Campo rotulo="Plano de ação"><textarea rows={2} className={input} value={form.action_plan} onChange={(e) => setForm({ ...form, action_plan: e.target.value })} /></Campo>
            <div className="flex justify-end gap-2">
              <BotaoSecundario type="button" onClick={() => setEdit(null)}>Cancelar</BotaoSecundario>
              <BotaoPrimario>Salvar</BotaoPrimario>
            </div>
          </form>
        </Modal>
      )}
      {del && <Confirmar titulo="Excluir pendência" texto="Excluir esta pendência?" onConfirm={excluir} onClose={() => setDel(null)} />}
    </Section>
  )
}
