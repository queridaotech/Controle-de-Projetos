import { useCallback, useEffect, useState } from 'react'
import { Briefcase, KeyRound, Pencil, Plus, ShieldCheck, UserCheck, UserX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { PageHeader } from '../components/ui'
import { Modal } from '../components/Modal'
import { BotaoPrimario, BotaoSecundario, Campo, SemSupabase, input } from '../components/forms'
import { PAPEL } from '../lib/labels'
import { useToast } from '../lib/toast'
import AlocacoesUsuario from './AlocacoesUsuario'

interface Usuario {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: 'admin' | 'consultant'
  active: boolean
  can_operate: boolean
  auto_assign_new_projects: boolean
  project_members: { count: number }[]
}

// Todas as mutações passam pela Edge Function (a service role fica no servidor)
async function chamar(corpo: Record<string, unknown>): Promise<{ erro?: string }> {
  const { data, error } = await supabase!.functions.invoke('admin-users', { body: corpo })
  if (error) {
    try {
      const resp = (error as { context?: Response }).context
      const j = resp ? await resp.json() : null
      return { erro: j?.error ?? 'Falha ao executar a operação.' }
    } catch {
      return { erro: 'Falha ao executar a operação.' }
    }
  }
  return data?.error ? { erro: data.error } : {}
}

function gerarSenha() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(14))
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('') + '#7'
}

export default function Usuarios() {
  const toast = useToast()
  const { perfil } = useAuth()
  const [lista, setLista] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState<'novo' | Usuario | null>(null)
  const [senhaDe, setSenhaDe] = useState<Usuario | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: 'consultant', password: '', can_operate: true })
  const [aloc, setAloc] = useState<Usuario | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [entregue, setEntregue] = useState<{ email: string; senha: string } | null>(null)

  const carregar = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.from('profiles').select('id, full_name, email, phone, role, active, can_operate, auto_assign_new_projects, project_members!project_members_user_id_fkey(count)').order('full_name')
    setLista((data as Usuario[]) ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (!supabase) return <SemSupabase />

  function abrirNovo() {
    setErro('')
    setForm({ full_name: '', email: '', phone: '', role: 'consultant', password: gerarSenha(), can_operate: true })
    setModal('novo')
  }

  function abrirEditar(u: Usuario) {
    setErro('')
    setForm({ full_name: u.full_name, email: u.email, phone: u.phone ?? '', role: u.role, password: '', can_operate: u.can_operate })
    setModal(u)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.full_name.trim()) return setErro('Informe o nome.')
    setSalvando(true)
    const r =
      modal === 'novo'
        ? await chamar({ action: 'create', ...form })
        : await chamar({ action: 'update', id: (modal as Usuario).id, full_name: form.full_name, phone: form.phone, role: form.role })
    setSalvando(false)
    if (r.erro) return setErro(r.erro)
    if (modal !== 'novo' && (modal as Usuario).can_operate !== form.can_operate) {
      const { error } = await supabase!.from('profiles').update({ can_operate: form.can_operate }).eq('id', (modal as Usuario).id)
      if (error) {
        carregar()
        return setErro(error.message || 'Não foi possível alterar a atuação operacional.')
      }
    }
    if (modal === 'novo') setEntregue({ email: form.email.trim().toLowerCase(), senha: form.password })
    else toast.ok('Usuário atualizado.')
    setModal(null)
    carregar()
  }

  async function alternarAtivo(u: Usuario) {
    const r = await chamar({ action: 'update', id: u.id, active: !u.active })
    if (r.erro) toast.erro(r.erro)
    else {
      toast.ok(u.active ? 'Usuário desativado.' : 'Usuário reativado.')
      carregar()
    }
  }

  async function redefinirSenha(e: React.FormEvent) {
    e.preventDefault()
    if (!senhaDe) return
    setSalvando(true)
    const r = await chamar({ action: 'reset_password', id: senhaDe.id, password: novaSenha })
    setSalvando(false)
    if (r.erro) return setErro(r.erro)
    setEntregue({ email: senhaDe.email, senha: novaSenha })
    setSenhaDe(null)
  }

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Contas de acesso da equipe Petrosupply"
        action={<BotaoPrimario onClick={abrirNovo}><Plus size={16} />Novo usuário</BotaoPrimario>}
      />

      <div className="card overflow-x-auto p-5">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              {['Nome', 'E-mail', 'Perfil', 'Projetos', 'Situação', ''].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id} className="border-b border-line/60 hover:bg-surface">
                <td className="px-3 py-3 font-medium">{u.full_name || '—'}{u.id === perfil?.id && <span className="ml-2 text-xs text-muted">(você)</span>}</td>
                <td className="px-3 py-3 text-muted">{u.email}</td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1">{u.role === 'admin' && <ShieldCheck size={14} className="text-brand" />}{PAPEL[u.role]}</span>
                </td>
                <td className="px-3 py-3">
                  {u.project_members?.[0]?.count ?? 0}
                  {!u.can_operate && <span className="ml-2 text-xs text-muted">(não operacional)</span>}
                  {u.auto_assign_new_projects && <span className="ml-2 text-xs text-brand-600">auto</span>}
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {u.active ? 'Ativo' : 'Desativado'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">
                  <button onClick={() => setAloc(u)} className="rounded p-1.5 text-muted hover:bg-line/50" title="Alocações em projetos"><Briefcase size={16} /></button>
                  <button onClick={() => abrirEditar(u)} className="rounded p-1.5 text-muted hover:bg-line/50" title="Editar"><Pencil size={16} /></button>
                  <button onClick={() => { setErro(''); setNovaSenha(gerarSenha()); setSenhaDe(u) }} className="rounded p-1.5 text-muted hover:bg-line/50" title="Redefinir senha"><KeyRound size={16} /></button>
                  {u.id !== perfil?.id && (
                    <button onClick={() => alternarAtivo(u)} className="rounded p-1.5 text-muted hover:bg-line/50" title={u.active ? 'Desativar' : 'Reativar'}>
                      {u.active ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {carregando && <tr><td colSpan={6} className="px-3 py-10 text-center text-muted">Carregando...</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal titulo={modal === 'novo' ? 'Novo usuário' : 'Editar usuário'} onClose={() => setModal(null)}>
          <form onSubmit={salvar} className="space-y-4" noValidate>
            <Campo rotulo="Nome completo *">
              <input className={input} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} autoFocus />
            </Campo>
            <Campo rotulo="E-mail *">
              <input className={input} type="email" value={form.email} disabled={modal !== 'novo'} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Telefone">
                <input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Campo>
              <Campo rotulo="Perfil de acesso">
                <select className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="consultant">Consultor</option>
                  <option value="admin">Administrador</option>
                </select>
              </Campo>
            </div>
            {modal !== 'novo' && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5" checked={form.can_operate} onChange={(e) => setForm({ ...form, can_operate: e.target.checked })} />
                <span>Pode atuar operacionalmente nos projetos<span className="block text-xs text-muted">Desmarcado, a pessoa não pode ser alocada. Remova antes as alocações existentes.</span></span>
              </label>
            )}
            {modal === 'novo' && (
              <Campo rotulo="Senha temporária" dica="Mínimo 10 caracteres. Repasse ao usuário por um canal seguro.">
                <input className={`${input} font-mono`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </Campo>
            )}
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <BotaoSecundario type="button" onClick={() => setModal(null)}>Cancelar</BotaoSecundario>
              <BotaoPrimario disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</BotaoPrimario>
            </div>
          </form>
        </Modal>
      )}

      {aloc && <AlocacoesUsuario usuario={aloc} onClose={() => setAloc(null)} onChanged={carregar} />}

      {senhaDe && (
        <Modal titulo={`Redefinir senha — ${senhaDe.full_name || senhaDe.email}`} onClose={() => setSenhaDe(null)}>
          <form onSubmit={redefinirSenha} className="space-y-4">
            <Campo rotulo="Nova senha temporária" dica="Mínimo 10 caracteres.">
              <input className={`${input} font-mono`} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
            </Campo>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex justify-end gap-2">
              <BotaoSecundario type="button" onClick={() => setSenhaDe(null)}>Cancelar</BotaoSecundario>
              <BotaoPrimario disabled={salvando}>{salvando ? 'Salvando...' : 'Redefinir'}</BotaoPrimario>
            </div>
          </form>
        </Modal>
      )}

      {entregue && (
        <Modal titulo="Credenciais de acesso" onClose={() => setEntregue(null)}>
          <p className="text-sm text-muted">Copie agora e envie ao usuário. Por segurança, a senha não será exibida novamente.</p>
          <div className="mt-4 space-y-2 rounded-lg bg-surface p-4 font-mono text-sm">
            <div>E-mail: {entregue.email}</div>
            <div>Senha: {entregue.senha}</div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <BotaoSecundario onClick={() => { navigator.clipboard?.writeText(`E-mail: ${entregue.email}\nSenha: ${entregue.senha}`); toast.ok('Copiado.') }}>Copiar</BotaoSecundario>
            <BotaoPrimario onClick={() => setEntregue(null)}>Concluir</BotaoPrimario>
          </div>
        </Modal>
      )}
    </>
  )
}
