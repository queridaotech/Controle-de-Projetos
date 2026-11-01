import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { Section } from '../../components/ui'
import { Modal } from '../../components/Modal'
import { BotaoPrimario, BotaoSecundario, Campo, input } from '../../components/forms'
import { formatarData } from '../../lib/format'
import { GRI, STATUS_CRIT, type AbaProps } from './comum'

interface Crit {
  id: string; code: string; name: string; status: string; gri_level: string | null
  last_updated_at: string | null; responsible_id: string | null; notes: string | null; pending_notes: string | null
}

const COR: Record<string, string> = {
  not_evaluated: 'bg-slate-100 text-slate-600', in_evaluation: 'bg-brand-50 text-brand-600',
  approved: 'bg-emerald-50 text-emerald-700', rejected: 'bg-red-50 text-red-600', pending: 'bg-amber-50 text-amber-700',
}

export default function AbaCriterios({ projetoId, equipe, recarregar }: AbaProps) {
  const toast = useToast()
  const [lista, setLista] = useState<Crit[]>([])
  const [edit, setEdit] = useState<Crit | null>(null)
  const [form, setForm] = useState({ status: 'not_evaluated', gri_level: 'not_evaluated', responsible_id: '', notes: '', pending_notes: '' })

  const carregar = useCallback(async () => {
    const { data } = await supabase!.from('project_criteria').select('*').eq('project_id', projetoId)
    const ordem = ['managerial', 'family_registration', 'legal', 'economic', 'gri', 'technical', 'lfo', 'certifications']
    setLista(((data as Crit[]) ?? []).sort((a, b) => ordem.indexOf(a.code) - ordem.indexOf(b.code)))
  }, [projetoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!edit) return
    const { error } = await supabase!.from('project_criteria').update({
      status: form.status,
      gri_level: edit.code === 'gri' ? form.gri_level : null,
      responsible_id: form.responsible_id || null,
      notes: form.notes.trim() || null,
      pending_notes: form.pending_notes.trim() || null,
      last_updated_at: new Date().toISOString().slice(0, 10),
    }).eq('id', edit.id)
    if (error) return toast.erro('Não foi possível salvar o critério.')
    toast.ok('Critério atualizado.')
    setEdit(null)
    carregar()
    recarregar()
  }

  return (
    <Section title="Critérios de avaliação Petrobras">
      <div className="grid gap-3 sm:grid-cols-2">
        {lista.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setForm({ status: c.status, gri_level: c.gri_level ?? 'not_evaluated', responsible_id: c.responsible_id ?? '', notes: c.notes ?? '', pending_notes: c.pending_notes ?? '' })
              setEdit(c)
            }}
            className="rounded-xl border border-line p-4 text-left transition hover:border-brand"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{c.name}</p>
              <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${COR[c.status]}`}>{STATUS_CRIT[c.status]}</span>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {c.code === 'gri' && c.gri_level && `Nível GRI: ${GRI[c.gri_level]} · `}
              {equipe.find((p) => p.id === c.responsible_id)?.nome ?? 'Sem responsável'} · atualizado {formatarData(c.last_updated_at)}
            </p>
            {c.pending_notes && <p className="mt-1.5 text-xs text-amber-700">Pendência: {c.pending_notes}</p>}
          </button>
        ))}
      </div>

      {edit && (
        <Modal titulo={edit.name} onClose={() => setEdit(null)}>
          <form onSubmit={salvar} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Situação">
                <select className={input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS_CRIT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Responsável">
                <select className={input} value={form.responsible_id} onChange={(e) => setForm({ ...form, responsible_id: e.target.value })}>
                  <option value="">—</option>
                  {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </Campo>
            </div>
            {edit.code === 'gri' && (
              <Campo rotulo="Nível de risco GRI">
                <select className={input} value={form.gri_level} onChange={(e) => setForm({ ...form, gri_level: e.target.value })}>
                  {Object.entries(GRI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
            )}
            <Campo rotulo="Observações"><textarea rows={3} className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Campo>
            <Campo rotulo="Pendências do critério"><textarea rows={2} className={input} value={form.pending_notes} onChange={(e) => setForm({ ...form, pending_notes: e.target.value })} /></Campo>
            <div className="flex justify-end gap-2">
              <BotaoSecundario type="button" onClick={() => setEdit(null)}>Cancelar</BotaoSecundario>
              <BotaoPrimario>Salvar</BotaoPrimario>
            </div>
          </form>
        </Modal>
      )}
    </Section>
  )
}
