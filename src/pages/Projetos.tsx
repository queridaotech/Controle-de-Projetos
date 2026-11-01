import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Archive, ArchiveRestore, FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import { PageHeader, Progress, StatusBadge } from '../components/ui'
import { Modal, Confirmar } from '../components/Modal'
import { BotaoPrimario, BotaoSecundario, Campo, SemSupabase, input } from '../components/forms'
import { STATUS_PROJETO, TIPO_CADASTRO } from '../lib/labels'
import { formatarData } from '../lib/format'

export type Modo = 'todos' | 'meus' | 'atrasados' | 'concluidos'

interface Linha {
  id: string
  name: string
  status: string
  progress: number
  start_date: string | null
  expected_end_date: string | null
  registration_type: string
  client_id: string
  project_type_id: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  estimated_days: number | null
  internal_notes: string | null
  archived_at: string | null
  client: { name: string } | null
  project_members: { user_id: string; member_role: 'principal' | 'auxiliary'; profile: { full_name: string } | null }[]
}

interface Opcao { id: string; name: string }
interface Pessoa { id: string; full_name: string; email: string }

const TITULOS: Record<Modo, [string, string]> = {
  todos: ['Todos os Projetos', 'Projetos de homologação CRC cadastrados'],
  meus: ['Meus Projetos', 'Projetos em que você está alocado'],
  atrasados: ['Projetos em Atraso', 'Prazo vencido ou status "Atrasado"'],
  concluidos: ['Projetos Concluídos', 'CRC concluído e registrado manualmente'],
}

const vazio = {
  client_id: '', project_type_id: '', name: '', registration_type: 'reseller_distributor',
  contact_name: '', contact_email: '', contact_phone: '', start_date: '', estimated_days: '',
  expected_end_date: '', internal_notes: '', principal: '', auxiliares: [] as string[],
}

function somarDias(data: string, dias: number) {
  const d = new Date(data + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

export default function Projetos({ modo }: { modo: Modo }) {
  const { perfil, ehAdmin } = useAuth()
  const toast = useToast()
  const [lista, setLista] = useState<Linha[]>([])
  const [clientes, setClientes] = useState<Opcao[]>([])
  const [tipos, setTipos] = useState<Opcao[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [params] = useSearchParams()
  const [busca, setBusca] = useState(params.get('q') ?? '')
  useEffect(() => setBusca(params.get('q') ?? ''), [params])
  const [status, setStatus] = useState('')
  const [arquivados, setArquivados] = useState(false)
  const [editando, setEditando] = useState<Linha | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<Linha | null>(null)
  const [form, setForm] = useState(vazio)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('projects')
      .select('*, client:clients(name), project_members(user_id, member_role, profile:profiles!project_members_user_id_fkey(full_name))')
      .order('created_at', { ascending: false })
    if (error) toast.erro('Não foi possível carregar os projetos.')
    setLista((data as unknown as Linha[]) ?? [])
    setCarregando(false)
  }, [toast])

  useEffect(() => {
    carregar()
    if (!supabase || !ehAdmin) return
    supabase.from('clients').select('id, name').eq('active', true).order('name').then(({ data }) => setClientes(data ?? []))
    supabase.from('project_types').select('id, name').eq('active', true).order('name').then(({ data }) => setTipos(data ?? []))
    supabase.from('profiles').select('id, full_name, email').eq('active', true).eq('can_operate', true).order('full_name').then(({ data }) => setPessoas((data as Pessoa[]) ?? []))
  }, [carregar, ehAdmin])

  const hoje = new Date().toISOString().slice(0, 10)

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lista.filter((p) => {
      if (!arquivados && p.archived_at) return false
      if (arquivados && !p.archived_at) return false
      const encerrado = ['completed', 'cancelled'].includes(p.status)
      if (modo === 'meus' && !p.project_members.some((m) => m.user_id === perfil?.id)) return false
      if (modo === 'concluidos' && p.status !== 'completed') return false
      if (modo === 'atrasados' && !(p.status === 'delayed' || (!encerrado && p.expected_end_date && p.expected_end_date < hoje))) return false
      if (status && p.status !== status) return false
      return !q || `${p.name} ${p.client?.name ?? ''}`.toLowerCase().includes(q)
    })
  }, [lista, busca, status, arquivados, modo, perfil, hoje])

  if (!supabase) return <SemSupabase />

  function abrir(p: Linha | 'novo') {
    setErro('')
    if (p === 'novo') {
      setForm({ ...vazio, project_type_id: tipos[0]?.id ?? '' })
    } else {
      setForm({
        client_id: p.client_id,
        project_type_id: p.project_type_id,
        name: p.name,
        registration_type: p.registration_type,
        contact_name: p.contact_name ?? '',
        contact_email: p.contact_email ?? '',
        contact_phone: p.contact_phone ?? '',
        start_date: p.start_date ?? '',
        estimated_days: p.estimated_days?.toString() ?? '',
        expected_end_date: p.expected_end_date ?? '',
        internal_notes: p.internal_notes ?? '',
        principal: p.project_members.find((m) => m.member_role === 'principal')?.user_id ?? '',
        auxiliares: p.project_members.filter((m) => m.member_role === 'auxiliary').map((m) => m.user_id),
      })
    }
    setEditando(p)
  }

  function alterarInicioOuDias(campo: 'start_date' | 'estimated_days', valor: string) {
    const f = { ...form, [campo]: valor }
    if (f.start_date && Number(f.estimated_days) > 0) f.expected_end_date = somarDias(f.start_date, Number(f.estimated_days))
    setForm(f)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.client_id) return setErro('Selecione o cliente.')
    if (!form.project_type_id) return setErro('Selecione o tipo de projeto.')
    if (!form.name.trim()) return setErro('Informe o nome do projeto.')
    if (!form.principal) return setErro('Defina o consultor principal.')
    if (form.start_date && form.expected_end_date && form.expected_end_date < form.start_date)
      return setErro('O prazo previsto não pode ser anterior ao início.')
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) return setErro('E-mail de contato inválido.')

    setSalvando(true)
    const payload = {
      client_id: form.client_id,
      project_type_id: form.project_type_id,
      name: form.name.trim(),
      registration_type: form.registration_type,
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      start_date: form.start_date || null,
      estimated_days: form.estimated_days ? Number(form.estimated_days) : null,
      expected_end_date: form.expected_end_date || null,
      internal_notes: form.internal_notes.trim() || null,
    }

    let projetoId: string
    if (editando === 'novo') {
      const { data, error } = await supabase!.from('projects').insert(payload).select('id').single()
      if (error || !data) {
        setSalvando(false)
        return setErro('Não foi possível criar o projeto.')
      }
      projetoId = data.id
    } else {
      projetoId = (editando as Linha).id
      const { error } = await supabase!.from('projects').update(payload).eq('id', projetoId)
      if (error) {
        setSalvando(false)
        return setErro('Não foi possível salvar o projeto.')
      }
    }

    // Alocação: aplica a diferença em ordem segura (índice único de consultor principal)
    const atuais = editando === 'novo' ? [] : (editando as Linha).project_members
    const desejados = new Map<string, 'principal' | 'auxiliary'>()
    form.auxiliares.filter((u) => u !== form.principal).forEach((u) => desejados.set(u, 'auxiliary'))
    desejados.set(form.principal, 'principal')

    const remover = atuais.filter((m) => !desejados.has(m.user_id)).map((m) => m.user_id)
    const rebaixar = atuais.filter((m) => desejados.get(m.user_id) === 'auxiliary' && m.member_role === 'principal').map((m) => m.user_id)
    const mapaAtual = new Map(atuais.map((m) => [m.user_id, m.member_role]))
    const novosAux = [...desejados].filter(([u, r]) => r === 'auxiliary' && !mapaAtual.has(u)).map(([u]) => u)
    const promover = form.principal && mapaAtual.get(form.principal) !== 'principal'

    let falhou = false
    const exec = async (p: PromiseLike<{ error: unknown }>) => {
      const { error } = await p
      if (error) falhou = true
    }
    if (remover.length) await exec(supabase!.from('project_members').delete().eq('project_id', projetoId).in('user_id', remover))
    if (rebaixar.length) await exec(supabase!.from('project_members').update({ member_role: 'auxiliary' }).eq('project_id', projetoId).in('user_id', rebaixar))
    if (novosAux.length) await exec(supabase!.from('project_members').insert(novosAux.map((user_id) => ({ project_id: projetoId, user_id, member_role: 'auxiliary' }))))
    if (promover) {
      if (mapaAtual.has(form.principal))
        await exec(supabase!.from('project_members').update({ member_role: 'principal' }).eq('project_id', projetoId).eq('user_id', form.principal))
      else await exec(supabase!.from('project_members').insert({ project_id: projetoId, user_id: form.principal, member_role: 'principal' }))
    }
    setSalvando(false)

    if (falhou) toast.erro('Projeto salvo, mas houve falha ao atualizar a equipe. Revise a alocação.')
    else toast.ok(editando === 'novo' ? 'Projeto criado com o roadmap CRC.' : 'Projeto atualizado.')
    setEditando(null)
    carregar()
  }

  async function alternarArquivo(p: Linha) {
    const { error } = await supabase!.from('projects').update({ archived_at: p.archived_at ? null : new Date().toISOString() }).eq('id', p.id)
    if (error) toast.erro('Não foi possível alterar o arquivamento.')
    else {
      toast.ok(p.archived_at ? 'Projeto restaurado.' : 'Projeto arquivado.')
      carregar()
    }
  }

  async function excluir() {
    if (!excluindo) return
    setSalvando(true)
    const { error } = await supabase!.from('projects').delete().eq('id', excluindo.id)
    setSalvando(false)
    if (error) toast.erro('Não foi possível excluir o projeto.')
    else {
      toast.ok('Projeto excluído.')
      carregar()
    }
    setExcluindo(null)
  }

  const [titulo, subtitulo] = TITULOS[modo]
  const disponiveisAux = pessoas.filter((p) => p.id !== form.principal)

  return (
    <>
      <PageHeader
        title={titulo}
        subtitle={subtitulo}
        action={ehAdmin && <BotaoPrimario onClick={() => abrir('novo')}><Plus size={16} />Novo projeto</BotaoPrimario>}
      />

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por projeto ou cliente" className={`${input} max-w-xs`} />
          {modo === 'todos' || modo === 'meus' ? (
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${input} max-w-[200px]`}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_PROJETO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={arquivados} onChange={(e) => setArquivados(e.target.checked)} />
            Ver arquivados
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                {['Cliente / Projeto', 'Consultor', 'Prazo', 'Status', 'Progresso', ''].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtrada.map((p) => {
                const principal = p.project_members.find((m) => m.member_role === 'principal')
                return (
                  <tr key={p.id} className="border-b border-line/60 hover:bg-surface">
                    <td className="px-3 py-3">
                      <Link to={`/projetos/${p.id}`} className="font-medium text-navy-900 hover:underline">{p.client?.name ?? p.name}</Link>
                      <div className="text-xs text-muted">{p.name} · {TIPO_CADASTRO[p.registration_type]}</div>
                    </td>
                    <td className="px-3 py-3">
                      {principal?.profile?.full_name ?? '—'}
                      {p.project_members.length > 1 && <div className="text-xs text-muted">+{p.project_members.length - 1} auxiliar(es)</div>}
                    </td>
                    <td className="px-3 py-3">{formatarData(p.expected_end_date)}</td>
                    <td className="px-3 py-3"><StatusBadge status={STATUS_PROJETO[p.status] ?? 'Em andamento'} /></td>
                    <td className="px-3 py-3"><Progress value={Math.round(Number(p.progress))} /></td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      {ehAdmin && (
                        <>
                          <button onClick={() => abrir(p)} className="rounded p-1.5 text-muted hover:bg-line/50" title="Editar"><Pencil size={16} /></button>
                          <button onClick={() => alternarArquivo(p)} className="rounded p-1.5 text-muted hover:bg-line/50" title={p.archived_at ? 'Restaurar' : 'Arquivar'}>
                            {p.archived_at ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                          </button>
                          <button onClick={() => setExcluindo(p)} className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600" title="Excluir"><Trash2 size={16} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!carregando && filtrada.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-muted"><FolderKanban className="mx-auto mb-2 text-brand" />Nenhum projeto encontrado.</td></tr>
              )}
              {carregando && <tr><td colSpan={6} className="px-3 py-10 text-center text-muted">Carregando...</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <Modal largo titulo={editando === 'novo' ? 'Novo projeto' : 'Editar projeto'} onClose={() => setEditando(null)}>
          <form onSubmit={salvar} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Cliente *">
                <select className={input} value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                  <option value="">Selecione...</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Tipo de projeto *">
                <select className={input} value={form.project_type_id} onChange={(e) => setForm({ ...form, project_type_id: e.target.value })}>
                  <option value="">Selecione...</option>
                  {tipos.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Campo>
            </div>
            <Campo rotulo="Nome do projeto *">
              <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Campo>
            <Campo rotulo="Tipo de cadastro CRC">
              <select className={input} value={form.registration_type} onChange={(e) => setForm({ ...form, registration_type: e.target.value })}>
                {Object.entries(TIPO_CADASTRO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo rotulo="Contato"><input className={input} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></Campo>
              <Campo rotulo="E-mail do contato"><input className={input} value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></Campo>
              <Campo rotulo="Telefone"><input className={input} value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo rotulo="Data de início"><input type="date" className={input} value={form.start_date} onChange={(e) => alterarInicioOuDias('start_date', e.target.value)} /></Campo>
              <Campo rotulo="Prazo estimado (dias)"><input type="number" min={1} className={input} value={form.estimated_days} onChange={(e) => alterarInicioOuDias('estimated_days', e.target.value)} /></Campo>
              <Campo rotulo="Prazo previsto"><input type="date" className={input} value={form.expected_end_date} onChange={(e) => setForm({ ...form, expected_end_date: e.target.value })} /></Campo>
            </div>
            <Campo rotulo="Consultor principal *">
              <select className={input} value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })}>
                <option value="">Selecione...</option>
                {pessoas.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
              </select>
            </Campo>
            <div>
              <span className="mb-1 block text-xs font-medium text-muted">Consultores auxiliares</span>
              <div className="grid max-h-36 gap-1 overflow-y-auto rounded-lg border border-line p-2 sm:grid-cols-2">
                {disponiveisAux.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.auxiliares.includes(p.id)}
                      onChange={(e) =>
                        setForm({ ...form, auxiliares: e.target.checked ? [...form.auxiliares, p.id] : form.auxiliares.filter((x) => x !== p.id) })
                      }
                    />
                    {p.full_name || p.email}
                  </label>
                ))}
                {disponiveisAux.length === 0 && <span className="text-xs text-muted">Nenhum outro usuário ativo.</span>}
              </div>
            </div>
            <Campo rotulo="Observações internas">
              <textarea className={input} rows={3} value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} />
            </Campo>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <BotaoSecundario type="button" onClick={() => setEditando(null)}>Cancelar</BotaoSecundario>
              <BotaoPrimario disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</BotaoPrimario>
            </div>
          </form>
        </Modal>
      )}

      {excluindo && (
        <Confirmar
          titulo="Excluir projeto"
          texto={`Excluir "${excluindo.name}" e todo o seu roadmap, documentos, tarefas e histórico? Esta ação não pode ser desfeita. Prefira arquivar se quiser apenas ocultar.`}
          onConfirm={excluir}
          onClose={() => setExcluindo(null)}
          carregando={salvando}
        />
      )}
    </>
  )
}
