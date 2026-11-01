import { useCallback, useEffect, useState } from 'react'
import { Boxes, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { PageHeader } from '../components/ui'
import { Modal, Confirmar } from '../components/Modal'
import { BotaoPrimario, BotaoSecundario, Campo, SemSupabase, input } from '../components/forms'

interface Linha { id: string; code: string | null; name: string; description: string | null; active: boolean; project_supply_families: { count: number }[] }
const vazio = { code: '', name: '', description: '', active: true }

export default function LinhasFornecimento() {
  const toast = useToast()
  const [lista, setLista] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [edit, setEdit] = useState<Linha | 'nova' | null>(null)
  const [del, setDel] = useState<Linha | null>(null)
  const [form, setForm] = useState(vazio)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.from('supply_families').select('*, project_supply_families(count)').order('name')
    setLista((data as Linha[]) ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (!supabase) return <SemSupabase />

  function abrir(l: Linha | 'nova') {
    setErro('')
    setForm(l === 'nova' ? vazio : { code: l.code ?? '', name: l.name, description: l.description ?? '', active: l.active })
    setEdit(l)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setErro('Informe o nome da linha.')
    const dados = { code: form.code.trim() || null, name: form.name.trim(), description: form.description.trim() || null, active: form.active }
    const { error } =
      edit === 'nova'
        ? await supabase!.from('supply_families').insert(dados)
        : await supabase!.from('supply_families').update(dados).eq('id', (edit as Linha).id)
    if (error) return setErro(error.code === '23505' ? 'Já existe uma linha com este código.' : 'Não foi possível salvar.')
    toast.ok('Linha salva.')
    setEdit(null)
    carregar()
  }

  async function excluir() {
    if (!del) return
    const { error } = await supabase!.from('supply_families').delete().eq('id', del.id)
    if (error) toast.erro(error.code === '23503' ? 'Linha em uso por projetos. Desative-a em vez de excluir.' : 'Não foi possível excluir.')
    else toast.ok('Linha excluída.')
    setDel(null)
    carregar()
  }

  return (
    <>
      <PageHeader
        title="Linhas de Fornecimento"
        subtitle="Famílias de materiais e serviços que podem ser vinculadas aos projetos"
        action={<BotaoPrimario onClick={() => abrir('nova')}><Plus size={16} />Nova linha</BotaoPrimario>}
      />
      <div className="card divide-y divide-line">
        {lista.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{l.name}{l.code && <span className="ml-2 text-xs font-normal text-muted">{l.code}</span>}</p>
              {l.description && <p className="text-xs text-muted">{l.description}</p>}
            </div>
            <span className="text-xs text-muted">{l.project_supply_families?.[0]?.count ?? 0} projeto(s)</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${l.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{l.active ? 'Ativa' : 'Inativa'}</span>
            <button onClick={() => abrir(l)} className="rounded p-1.5 text-muted hover:bg-line/50" title="Editar"><Pencil size={16} /></button>
            <button onClick={() => setDel(l)} className="rounded p-1.5 text-muted hover:text-red-600" title="Excluir"><Trash2 size={16} /></button>
          </div>
        ))}
        {!carregando && lista.length === 0 && <div className="p-10 text-center text-sm text-muted"><Boxes className="mx-auto mb-2 text-brand" />Nenhuma linha cadastrada.</div>}
        {carregando && <div className="p-10 text-center text-sm text-muted">Carregando...</div>}
      </div>

      {edit && (
        <Modal titulo={edit === 'nova' ? 'Nova linha' : 'Editar linha'} onClose={() => setEdit(null)}>
          <form onSubmit={salvar} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo rotulo="Código"><input className={input} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Campo>
              <div className="sm:col-span-2"><Campo rotulo="Nome *"><input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Campo></div>
            </div>
            <Campo rotulo="Descrição"><textarea rows={3} className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Campo>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />Linha ativa</label>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex justify-end gap-2">
              <BotaoSecundario type="button" onClick={() => setEdit(null)}>Cancelar</BotaoSecundario>
              <BotaoPrimario>Salvar</BotaoPrimario>
            </div>
          </form>
        </Modal>
      )}
      {del && <Confirmar titulo="Excluir linha" texto={`Excluir "${del.name}"?`} onConfirm={excluir} onClose={() => setDel(null)} />}
    </>
  )
}
