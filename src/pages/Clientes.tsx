import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/ui'
import { Modal, Confirmar } from '../components/Modal'
import { BotaoPrimario, BotaoSecundario, Campo, SemSupabase, input } from '../components/forms'
import { apenasDigitos, formatarCnpj, validarCnpj } from '../lib/format'
import { useToast } from '../lib/toast'

interface Cliente {
  id: string
  name: string
  cnpj: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  notes: string | null
  active: boolean
  projects: { count: number }[]
}

const vazio = { name: '', cnpj: '', contact_name: '', email: '', phone: '', notes: '', active: true }

export default function Clientes() {
  const toast = useToast()
  const [lista, setLista] = useState<Cliente[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<Cliente | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<Cliente | null>(null)
  const [form, setForm] = useState(vazio)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.from('clients').select('*, projects(count)').order('name')
    if (error) toast.erro('Não foi possível carregar os clientes.')
    setLista((data as Cliente[]) ?? [])
    setCarregando(false)
  }, [toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lista.filter((c) => !q || (c.name + (c.cnpj ?? '') + (c.contact_name ?? '')).toLowerCase().includes(q))
  }, [lista, busca])

  if (!supabase) return <SemSupabase />

  function abrir(c: Cliente | 'novo') {
    setErros({})
    setForm(
      c === 'novo'
        ? vazio
        : {
            name: c.name,
            cnpj: c.cnpj ?? '',
            contact_name: c.contact_name ?? '',
            email: c.email ?? '',
            phone: c.phone ?? '',
            notes: c.notes ?? '',
            active: c.active,
          },
    )
    setEditando(c)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const er: Record<string, string> = {}
    if (!form.name.trim()) er.name = 'Informe o nome da empresa.'
    if (form.cnpj && !validarCnpj(form.cnpj)) er.cnpj = 'CNPJ inválido.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) er.email = 'E-mail inválido.'
    setErros(er)
    if (Object.keys(er).length) return

    setSalvando(true)
    const payload = {
      name: form.name.trim(),
      cnpj: form.cnpj ? formatarCnpj(form.cnpj) : null,
      contact_name: form.contact_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
      active: form.active,
    }
    const { error } =
      editando === 'novo'
        ? await supabase!.from('clients').insert(payload)
        : await supabase!.from('clients').update(payload).eq('id', (editando as Cliente).id)
    setSalvando(false)

    if (error) {
      if (error.code === '23505') setErros({ cnpj: 'Já existe um cliente com este CNPJ.' })
      else toast.erro('Não foi possível salvar o cliente.')
      return
    }
    toast.ok(editando === 'novo' ? 'Cliente cadastrado.' : 'Cliente atualizado.')
    setEditando(null)
    carregar()
  }

  async function excluir() {
    if (!excluindo) return
    setSalvando(true)
    const { error } = await supabase!.from('clients').delete().eq('id', excluindo.id)
    setSalvando(false)
    if (error) {
      toast.erro(error.code === '23503' ? 'Este cliente possui projetos. Desative-o em vez de excluir.' : 'Não foi possível excluir.')
    } else {
      toast.ok('Cliente excluído.')
      carregar()
    }
    setExcluindo(null)
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Empresas atendidas nos projetos de homologação"
        action={<BotaoPrimario onClick={() => abrir('novo')}><Plus size={16} />Novo cliente</BotaoPrimario>}
      />

      <div className="card p-5">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, CNPJ ou contato"
          className={`${input} mb-4 max-w-sm`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                {['Empresa', 'CNPJ', 'Contato', 'Projetos', 'Situação', ''].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrada.map((c) => (
                <tr key={c.id} className="border-b border-line/60 hover:bg-surface">
                  <td className="px-3 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3 text-muted">{c.cnpj ?? '—'}</td>
                  <td className="px-3 py-3">
                    {c.contact_name ?? '—'}
                    {c.email && <div className="text-xs text-muted">{c.email}</div>}
                  </td>
                  <td className="px-3 py-3">{c.projects?.[0]?.count ?? 0}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${c.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button onClick={() => abrir(c)} className="rounded p-1.5 text-muted hover:bg-line/50" title="Editar"><Pencil size={16} /></button>
                    <button onClick={() => setExcluindo(c)} className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600" title="Excluir"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {!carregando && filtrada.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted">
                    <Building2 className="mx-auto mb-2 text-brand" />
                    {lista.length === 0 ? 'Nenhum cliente cadastrado ainda.' : 'Nenhum cliente encontrado.'}
                  </td>
                </tr>
              )}
              {carregando && <tr><td colSpan={6} className="px-3 py-10 text-center text-muted">Carregando...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <Modal titulo={editando === 'novo' ? 'Novo cliente' : 'Editar cliente'} onClose={() => setEditando(null)}>
          <form onSubmit={salvar} className="space-y-4" noValidate>
            <Campo rotulo="Nome da empresa *" erro={erros.name}>
              <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </Campo>
            <Campo rotulo="CNPJ" erro={erros.cnpj}>
              <input
                className={input}
                value={form.cnpj}
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                onChange={(e) => setForm({ ...form, cnpj: formatarCnpj(e.target.value) })}
              />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Contato principal">
                <input className={input} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </Campo>
              <Campo rotulo="Telefone">
                <input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Campo>
            </div>
            <Campo rotulo="E-mail" erro={erros.email}>
              <input className={input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Campo>
            <Campo rotulo="Observações">
              <textarea className={input} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Campo>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Cliente ativo
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <BotaoSecundario type="button" onClick={() => setEditando(null)}>Cancelar</BotaoSecundario>
              <BotaoPrimario disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</BotaoPrimario>
            </div>
          </form>
        </Modal>
      )}

      {excluindo && (
        <Confirmar
          titulo="Excluir cliente"
          texto={`Excluir "${excluindo.name}"${excluindo.cnpj ? ` (${apenasDigitos(excluindo.cnpj).length === 14 ? excluindo.cnpj : ''})` : ''}? Esta ação não pode ser desfeita.`}
          onConfirm={excluir}
          onClose={() => setExcluindo(null)}
          carregando={salvando}
        />
      )}
    </>
  )
}
