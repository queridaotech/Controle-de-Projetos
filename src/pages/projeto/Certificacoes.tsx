import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { Section } from '../../components/ui'
import { Modal, Confirmar } from '../../components/Modal'
import { BotaoPrimario, BotaoSecundario, Campo, input } from '../../components/forms'
import { formatarData } from '../../lib/format'
import { hojeISO, type AbaProps } from './comum'

interface Cert { id: string; cert_type: string; other_name: string | null; identifier: string | null; valid_until: string | null; status: string }

const TIPO: Record<string, string> = { iso_9001: 'ISO 9001', iso_14001: 'ISO 14001', iso_45001: 'ISO 45001', api: 'API', other: 'Outra' }
const STATUS: Record<string, string> = { valid: 'Válida', expired: 'Vencida', pending: 'Pendente', not_applicable: 'Não aplicável' }
const vazio = { cert_type: 'iso_9001', other_name: '', identifier: '', valid_until: '', status: 'valid' }

export default function Certificacoes({ projetoId, recarregar }: AbaProps) {
  const toast = useToast()
  const [lista, setLista] = useState<Cert[]>([])
  const [edit, setEdit] = useState<Cert | 'nova' | null>(null)
  const [del, setDel] = useState<Cert | null>(null)
  const [form, setForm] = useState(vazio)

  const carregar = useCallback(async () => {
    const { data } = await supabase!.from('project_certifications').select('*').eq('project_id', projetoId).order('created_at')
    setLista((data as Cert[]) ?? [])
  }, [projetoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  function abrir(c: Cert | 'nova') {
    setForm(c === 'nova' ? vazio : { cert_type: c.cert_type, other_name: c.other_name ?? '', identifier: c.identifier ?? '', valid_until: c.valid_until ?? '', status: c.status })
    setEdit(c)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (form.cert_type === 'other' && !form.other_name.trim()) return toast.erro('Informe o nome da certificação.')
    const dados = {
      cert_type: form.cert_type, other_name: form.cert_type === 'other' ? form.other_name.trim() : null,
      identifier: form.identifier.trim() || null, valid_until: form.valid_until || null, status: form.status,
    }
    const { error } =
      edit === 'nova'
        ? await supabase!.from('project_certifications').insert({ ...dados, project_id: projetoId })
        : await supabase!.from('project_certifications').update(dados).eq('id', (edit as Cert).id)
    if (error) return toast.erro('Não foi possível salvar a certificação.')
    toast.ok('Certificação salva.')
    setEdit(null)
    carregar()
    recarregar()
  }

  async function excluir() {
    if (!del) return
    const { error } = await supabase!.from('project_certifications').delete().eq('id', del.id)
    if (error) toast.erro('Não foi possível excluir.')
    setDel(null)
    carregar()
  }

  const hoje = hojeISO()

  return (
    <Section title="Certificações" action={<BotaoSecundario onClick={() => abrir('nova')}><Plus size={14} />Nova</BotaoSecundario>}>
      {lista.length === 0 ? <p className="text-sm text-muted">Nenhuma certificação cadastrada.</p> : (
        <ul className="divide-y divide-line text-sm">
          {lista.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <button onClick={() => abrir(c)} className="flex-1 text-left font-medium hover:underline">
                {c.cert_type === 'other' ? c.other_name : TIPO[c.cert_type]}{c.identifier && <span className="font-normal text-muted"> · {c.identifier}</span>}
              </button>
              <span className={`text-xs ${c.valid_until && c.valid_until < hoje && c.status === 'valid' ? 'text-red-600' : 'text-muted'}`}>
                {STATUS[c.status]}{c.valid_until && ` · até ${formatarData(c.valid_until)}`}
              </span>
              <button onClick={() => setDel(c)} className="rounded p-1 text-muted hover:text-red-600" title="Excluir"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      {edit && (
        <Modal titulo={edit === 'nova' ? 'Nova certificação' : 'Editar certificação'} onClose={() => setEdit(null)}>
          <form onSubmit={salvar} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Tipo">
                <select className={input} value={form.cert_type} onChange={(e) => setForm({ ...form, cert_type: e.target.value })}>
                  {Object.entries(TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Situação">
                <select className={input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
            </div>
            {form.cert_type === 'other' && <Campo rotulo="Nome *"><input className={input} value={form.other_name} onChange={(e) => setForm({ ...form, other_name: e.target.value })} /></Campo>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Número / identificador"><input className={input} value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} /></Campo>
              <Campo rotulo="Válida até"><input type="date" className={input} value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></Campo>
            </div>
            <div className="flex justify-end gap-2">
              <BotaoSecundario type="button" onClick={() => setEdit(null)}>Cancelar</BotaoSecundario>
              <BotaoPrimario>Salvar</BotaoPrimario>
            </div>
          </form>
        </Modal>
      )}
      {del && <Confirmar titulo="Excluir certificação" texto="Excluir esta certificação?" onConfirm={excluir} onClose={() => setDel(null)} />}
    </Section>
  )
}
