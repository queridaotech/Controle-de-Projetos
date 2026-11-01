import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { Section, Progress } from '../../components/ui'
import { Modal, Confirmar } from '../../components/Modal'
import { BotaoPrimario, BotaoSecundario, Campo, input } from '../../components/forms'
import { STATUS_ETAPA } from '../../lib/labels'
import { formatarData } from '../../lib/format'
import { STATUS_MARCO, hojeISO, type AbaProps } from './comum'

interface Etapa {
  id: string; position: number; name: string; objective: string | null; status: string; progress: number
  responsible_id: string | null; start_date: string | null; due_date: string | null; notes: string | null; weight: number
}
interface Marco { id: string; title: string; planned_date: string | null; status: string; stage_id: string | null; completed_at: string | null }
interface Crc { status: string; crc_number: string | null; crc_issued_at: string | null }

export default function AbaRoadmap({ projetoId, equipe, recarregar }: AbaProps) {
  const toast = useToast()
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [marcos, setMarcos] = useState<Marco[]>([])
  const [crc, setCrc] = useState<Crc | null>(null)
  const [edEtapa, setEdEtapa] = useState<Etapa | null>(null)
  const [edMarco, setEdMarco] = useState<Marco | 'novo' | null>(null)
  const [delMarco, setDelMarco] = useState<Marco | null>(null)
  const [formE, setFormE] = useState({ status: 'not_started', responsible_id: '', start_date: '', due_date: '', notes: '' })
  const [formM, setFormM] = useState({ title: '', planned_date: '', stage_id: '' })
  const [formC, setFormC] = useState({ crc_number: '', crc_issued_at: '' })
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const [e, m, c] = await Promise.all([
      supabase!.from('project_stages').select('*').eq('project_id', projetoId).order('position'),
      supabase!.from('milestones').select('*').eq('project_id', projetoId).order('planned_date', { nullsFirst: false }),
      supabase!.from('projects').select('status, crc_number, crc_issued_at').eq('id', projetoId).single(),
    ])
    setEtapas((e.data as Etapa[]) ?? [])
    setMarcos((m.data as Marco[]) ?? [])
    setCrc(c.data as Crc)
    if (c.data) setFormC({ crc_number: c.data.crc_number ?? '', crc_issued_at: c.data.crc_issued_at ?? '' })
  }, [projetoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function salvarEtapa(e: React.FormEvent) {
    e.preventDefault()
    if (!edEtapa) return
    if (formE.start_date && formE.due_date && formE.due_date < formE.start_date) return toast.erro('O prazo não pode ser anterior ao início.')
    setSalvando(true)
    const { error } = await supabase!.from('project_stages').update({
      status: formE.status,
      responsible_id: formE.responsible_id || null,
      start_date: formE.start_date || null,
      due_date: formE.due_date || null,
      notes: formE.notes.trim() || null,
    }).eq('id', edEtapa.id)
    setSalvando(false)
    if (error) return toast.erro(error.message || 'Não foi possível salvar a etapa.')
    toast.ok('Etapa atualizada.')
    setEdEtapa(null)
    carregar()
    recarregar()
  }

  async function salvarMarco(e: React.FormEvent) {
    e.preventDefault()
    if (!formM.title.trim()) return toast.erro('Informe o título do milestone.')
    setSalvando(true)
    const dados = { title: formM.title.trim(), planned_date: formM.planned_date || null, stage_id: formM.stage_id || null }
    const { error } =
      edMarco === 'novo'
        ? await supabase!.from('milestones').insert({ ...dados, project_id: projetoId })
        : await supabase!.from('milestones').update(dados).eq('id', (edMarco as Marco).id)
    setSalvando(false)
    if (error) return toast.erro('Não foi possível salvar o milestone.')
    toast.ok('Milestone salvo.')
    setEdMarco(null)
    carregar()
    recarregar()
  }

  async function alternarMarco(m: Marco) {
    const { error } = await supabase!.from('milestones').update({ status: m.status === 'completed' ? 'pending' : 'completed' }).eq('id', m.id)
    if (error) toast.erro('Não foi possível atualizar.')
    carregar()
    recarregar()
  }

  async function excluirMarco() {
    if (!delMarco) return
    const { error } = await supabase!.from('milestones').delete().eq('id', delMarco.id)
    if (error) toast.erro('Não foi possível excluir.')
    else toast.ok('Milestone excluído.')
    setDelMarco(null)
    carregar()
    recarregar()
  }

  // A conclusão do CRC é sempre um ato manual do consultor; o banco valida as regras.
  async function registrarConclusao(e: React.FormEvent) {
    e.preventDefault()
    if (!formC.crc_number.trim() || !formC.crc_issued_at) return toast.erro('Informe o número do CRC e a data de emissão.')
    setSalvando(true)
    const { error } = await supabase!.from('projects').update({
      crc_number: formC.crc_number.trim(),
      crc_issued_at: formC.crc_issued_at,
      status: 'completed',
    }).eq('id', projetoId)
    setSalvando(false)
    if (error) return toast.erro(error.message || 'Não foi possível registrar a conclusão.')
    toast.ok('Conclusão do CRC registrada.')
    carregar()
    recarregar()
  }

  const hoje = hojeISO()

  return (
    <div className="space-y-5">
      <Section title="Etapas do roadmap CRC">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                {['#', 'Etapa', 'Responsável', 'Prazo', 'Situação', 'Progresso', ''].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {etapas.map((e) => (
                <tr key={e.id} className="border-b border-line/60 hover:bg-surface">
                  <td className="px-3 py-3 text-muted">{e.position}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{e.name}</p>
                    {e.objective && <p className="text-xs text-muted">{e.objective}</p>}
                  </td>
                  <td className="px-3 py-3">{equipe.find((x) => x.id === e.responsible_id)?.nome ?? '—'}</td>
                  <td className={`px-3 py-3 ${e.due_date && e.due_date < hoje && e.status !== 'completed' ? 'text-red-600' : ''}`}>{formatarData(e.due_date)}</td>
                  <td className="px-3 py-3">{STATUS_ETAPA[e.status]}</td>
                  <td className="px-3 py-3"><Progress value={Math.round(Number(e.progress))} /></td>
                  <td className="px-3 py-3 text-right">
                    <button
                      className="text-xs font-medium text-brand-600 hover:underline"
                      onClick={() => {
                        setFormE({ status: e.status, responsible_id: e.responsible_id ?? '', start_date: e.start_date ?? '', due_date: e.due_date ?? '', notes: e.notes ?? '' })
                        setEdEtapa(e)
                      }}
                    >
                      Gerenciar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">Etapas em andamento calculam o progresso pelas tarefas concluídas; etapas concluídas valem 100%.</p>
      </Section>

      <Section
        title="Milestones"
        action={<BotaoSecundario onClick={() => { setFormM({ title: '', planned_date: '', stage_id: '' }); setEdMarco('novo') }}><Plus size={14} />Novo</BotaoSecundario>}
      >
        {marcos.length === 0 ? <p className="text-sm text-muted">Nenhum milestone.</p> : (
          <ul className="divide-y divide-line">
            {marcos.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <input type="checkbox" checked={m.status === 'completed'} onChange={() => alternarMarco(m)} aria-label="Concluído" />
                <button
                  className={`flex-1 text-left ${m.status === 'completed' ? 'text-muted line-through' : 'font-medium'}`}
                  onClick={() => { setFormM({ title: m.title, planned_date: m.planned_date ?? '', stage_id: m.stage_id ?? '' }); setEdMarco(m) }}
                >
                  {m.title}
                </button>
                <span className={`text-xs ${m.status !== 'completed' && m.planned_date && m.planned_date < hoje ? 'text-red-600' : 'text-muted'}`}>
                  {formatarData(m.planned_date)} · {STATUS_MARCO[m.status]}
                </span>
                <button onClick={() => setDelMarco(m)} className="rounded p-1 text-muted hover:text-red-600" title="Excluir"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Conclusão do CRC">
        {crc?.status === 'completed' ? (
          <p className="text-sm">CRC <strong>{crc.crc_number}</strong> emitido em {formatarData(crc.crc_issued_at)}. Projeto concluído.</p>
        ) : (
          <form onSubmit={registrarConclusao} className="grid items-end gap-4 sm:grid-cols-3">
            <Campo rotulo="Número do CRC"><input className={input} value={formC.crc_number} onChange={(e) => setFormC({ ...formC, crc_number: e.target.value })} /></Campo>
            <Campo rotulo="Data de emissão"><input type="date" className={input} value={formC.crc_issued_at} onChange={(e) => setFormC({ ...formC, crc_issued_at: e.target.value })} /></Campo>
            <BotaoPrimario disabled={salvando}>Registrar conclusão</BotaoPrimario>
          </form>
        )}
        <p className="mt-3 text-xs text-muted">A conclusão nunca é presumida: só é registrada aqui, manualmente, depois que a Petrobras emitir o CRC.</p>
      </Section>

      {edEtapa && (
        <Modal titulo={`Etapa ${edEtapa.position} — ${edEtapa.name}`} onClose={() => setEdEtapa(null)}>
          <form onSubmit={salvarEtapa} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Situação">
                <select className={input} value={formE.status} onChange={(e) => setFormE({ ...formE, status: e.target.value })}>
                  {Object.entries(STATUS_ETAPA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Responsável">
                <select className={input} value={formE.responsible_id} onChange={(e) => setFormE({ ...formE, responsible_id: e.target.value })}>
                  <option value="">—</option>
                  {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Início"><input type="date" className={input} value={formE.start_date} onChange={(e) => setFormE({ ...formE, start_date: e.target.value })} /></Campo>
              <Campo rotulo="Prazo"><input type="date" className={input} value={formE.due_date} onChange={(e) => setFormE({ ...formE, due_date: e.target.value })} /></Campo>
            </div>
            <Campo rotulo="Observações"><textarea rows={3} className={input} value={formE.notes} onChange={(e) => setFormE({ ...formE, notes: e.target.value })} /></Campo>
            <div className="flex justify-end gap-2">
              <BotaoSecundario type="button" onClick={() => setEdEtapa(null)}>Cancelar</BotaoSecundario>
              <BotaoPrimario disabled={salvando}>Salvar</BotaoPrimario>
            </div>
          </form>
        </Modal>
      )}

      {edMarco && (
        <Modal titulo={edMarco === 'novo' ? 'Novo milestone' : 'Editar milestone'} onClose={() => setEdMarco(null)}>
          <form onSubmit={salvarMarco} className="space-y-4">
            <Campo rotulo="Título *"><input className={input} value={formM.title} onChange={(e) => setFormM({ ...formM, title: e.target.value })} autoFocus /></Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Data prevista"><input type="date" className={input} value={formM.planned_date} onChange={(e) => setFormM({ ...formM, planned_date: e.target.value })} /></Campo>
              <Campo rotulo="Etapa">
                <select className={input} value={formM.stage_id} onChange={(e) => setFormM({ ...formM, stage_id: e.target.value })}>
                  <option value="">—</option>
                  {etapas.map((x) => <option key={x.id} value={x.id}>{x.position}. {x.name}</option>)}
                </select>
              </Campo>
            </div>
            <div className="flex justify-end gap-2">
              <BotaoSecundario type="button" onClick={() => setEdMarco(null)}>Cancelar</BotaoSecundario>
              <BotaoPrimario disabled={salvando}>Salvar</BotaoPrimario>
            </div>
          </form>
        </Modal>
      )}

      {delMarco && <Confirmar titulo="Excluir milestone" texto={`Excluir "${delMarco.title}"?`} onConfirm={excluirMarco} onClose={() => setDelMarco(null)} />}
    </div>
  )
}
