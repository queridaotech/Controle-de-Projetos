import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { Section } from '../../components/ui'
import { Modal, Confirmar } from '../../components/Modal'
import { BotaoPrimario, BotaoSecundario, Campo, input } from '../../components/forms'
import { formatarDataHora } from '../../lib/format'
import type { AbaProps } from './comum'

interface Cred {
  id: string; platform_name: string; url: string | null; login: string | null; access_email: string | null
  notes: string | null; responsible_id: string | null
}
interface Acesso { id: string; action: string; detail: string | null; created_at: string; profile: { full_name: string } | null }

const ROTULO_ACAO: Record<string, string> = {
  create: 'Criou', update: 'Alterou', reveal: 'Visualizou a senha', delete: 'Excluiu',
  denied_reveal: 'Tentativa NEGADA de ver senha', denied_save: 'Tentativa NEGADA de salvar', denied_delete: 'Tentativa NEGADA de excluir',
}
const vazio = { platform_name: '', url: '', login: '', access_email: '', password: '', notes: '', responsible_id: '' }

export default function AbaCredenciais({ projetoId, equipe }: AbaProps) {
  const toast = useToast()
  const [lista, setLista] = useState<Cred[]>([])
  const [acessos, setAcessos] = useState<Acesso[]>([])
  const [edit, setEdit] = useState<Cred | 'nova' | null>(null)
  const [del, setDel] = useState<Cred | null>(null)
  const [confirmar, setConfirmar] = useState<Cred | null>(null)
  const [revelada, setRevelada] = useState<{ id: string; senha: string } | null>(null)
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    // Colunas explícitas: o conteúdo cifrado nunca é necessário na interface
    const [c, a] = await Promise.all([
      supabase!.from('project_credentials')
        .select('id, platform_name, url, login, access_email, notes, responsible_id')
        .eq('project_id', projetoId).order('platform_name'),
      supabase!.from('credential_access_logs')
        .select('id, action, detail, created_at, profile:profiles(full_name)')
        .eq('project_id', projetoId).order('created_at', { ascending: false }).limit(15),
    ])
    setLista((c.data as unknown as Cred[]) ?? [])
    setAcessos((a.data as unknown as Acesso[]) ?? [])
  }, [projetoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Oculta a senha automaticamente após 30 s
  useEffect(() => {
    if (!revelada) return
    const t = setTimeout(() => setRevelada(null), 30000)
    return () => clearTimeout(t)
  }, [revelada])

  function abrir(c: Cred | 'nova') {
    setForm(c === 'nova' ? vazio : {
      platform_name: c.platform_name, url: c.url ?? '', login: c.login ?? '', access_email: c.access_email ?? '',
      password: '', notes: c.notes ?? '', responsible_id: c.responsible_id ?? '',
    })
    setEdit(c)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.platform_name.trim()) return toast.erro('Informe a plataforma.')
    setSalvando(true)
    const { data: salvaId, error } = await supabase!.rpc('save_credential', {
      p_project: projetoId, p_platform: form.platform_name.trim(), p_url: form.url.trim() || null,
      p_login: form.login.trim() || null, p_email: form.access_email.trim() || null,
      p_password: form.password || null, p_notes: form.notes.trim() || null,
      p_responsible: form.responsible_id || null, p_id: edit === 'nova' ? null : (edit as Cred).id,
    })
    setSalvando(false)
    if (error) return toast.erro('Não foi possível salvar a credencial.')
    if (!salvaId) {
      carregar()
      return toast.erro('Acesso negado. A tentativa foi registrada.')
    }
    toast.ok('Credencial salva com criptografia.')
    setEdit(null)
    carregar()
  }

  async function revelar() {
    if (!confirmar) return
    const { data, error } = await supabase!.rpc('reveal_credential', { p_id: confirmar.id })
    setConfirmar(null)
    const r = data as { ok: boolean; password?: string | null; error?: string } | null
    if (error || !r) return toast.erro('Não foi possível revelar a senha.')
    if (!r.ok) {
      carregar()
      return toast.erro(r.error ?? 'Acesso negado.')
    }
    setRevelada({ id: confirmar.id, senha: r.password ?? '' })
    carregar()
  }

  async function excluir() {
    if (!del) return
    const { data: ok, error } = await supabase!.rpc('delete_credential', { p_id: del.id })
    if (error) toast.erro('Não foi possível excluir.')
    else if (!ok) toast.erro('Acesso negado. A tentativa foi registrada.')
    else toast.ok('Credencial excluída.')
    setDel(null)
    carregar()
  }

  return (
    <div className="space-y-5">
      <Section
        title="Cofre de credenciais"
        action={<BotaoSecundario onClick={() => abrir('nova')}><Plus size={14} />Nova</BotaoSecundario>}
      >
        <p className="mb-4 flex items-center gap-2 text-xs text-muted">
          <Lock size={13} />Senhas armazenadas criptografadas. Cada visualização é registrada. Esta aba nunca aparece no portal do cliente.
        </p>
        {lista.length === 0 ? <p className="text-sm text-muted">Nenhuma credencial cadastrada.</p> : (
          <ul className="divide-y divide-line">
            {lista.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.platform_name}</p>
                  <p className="text-xs text-muted">
                    {[c.login, c.access_email].filter(Boolean).join(' · ') || 'Sem login informado'}
                    {c.url && <> · <a href={/^https?:\/\//.test(c.url) ? c.url : `https://${c.url}`} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{c.url}</a></>}
                  </p>
                  {revelada?.id === c.id && (
                    <p className="mt-1 font-mono text-sm">{revelada.senha || <span className="text-muted">Sem senha cadastrada</span>}</p>
                  )}
                </div>
                {revelada?.id === c.id ? (
                  <button onClick={() => setRevelada(null)} className="rounded p-1.5 text-muted hover:bg-line/50" title="Ocultar"><EyeOff size={16} /></button>
                ) : (
                  <button onClick={() => setConfirmar(c)} className="rounded p-1.5 text-muted hover:bg-line/50" title="Revelar senha"><Eye size={16} /></button>
                )}
                <button onClick={() => abrir(c)} className="rounded p-1.5 text-muted hover:bg-line/50" title="Editar"><Pencil size={16} /></button>
                <button onClick={() => setDel(c)} className="rounded p-1.5 text-muted hover:text-red-600" title="Excluir"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Auditoria de acessos (visível a administradores)">
        {acessos.length === 0 ? <p className="text-sm text-muted">Sem registros.</p> : (
          <ul className="divide-y divide-line text-sm">
            {acessos.map((a) => (
              <li key={a.id} className={`flex justify-between gap-3 py-2 ${a.action.startsWith('denied') ? 'font-medium text-red-600' : ''}`}>
                <span>{a.profile?.full_name ?? 'Usuário removido'} — {ROTULO_ACAO[a.action]}{a.detail && <span className="font-normal text-muted"> ({a.detail})</span>}</span>
                <span className="text-xs text-muted">{formatarDataHora(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {edit && (
        <Modal titulo={edit === 'nova' ? 'Nova credencial' : 'Editar credencial'} onClose={() => setEdit(null)}>
          <form onSubmit={salvar} className="space-y-4" autoComplete="off">
            <Campo rotulo="Plataforma *"><input className={input} value={form.platform_name} onChange={(e) => setForm({ ...form, platform_name: e.target.value })} autoFocus /></Campo>
            <Campo rotulo="URL"><input className={input} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Login"><input className={input} value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} autoComplete="off" /></Campo>
              <Campo rotulo="E-mail de acesso"><input className={input} value={form.access_email} onChange={(e) => setForm({ ...form, access_email: e.target.value })} /></Campo>
            </div>
            <Campo rotulo="Senha" dica={edit === 'nova' ? undefined : 'Deixe em branco para manter a senha atual.'}>
              <input type="password" className={input} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
            </Campo>
            <Campo rotulo="Responsável">
              <select className={input} value={form.responsible_id} onChange={(e) => setForm({ ...form, responsible_id: e.target.value })}>
                <option value="">—</option>
                {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Observações"><textarea rows={2} className={input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Campo>
            <div className="flex justify-end gap-2">
              <BotaoSecundario type="button" onClick={() => setEdit(null)}>Cancelar</BotaoSecundario>
              <BotaoPrimario disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</BotaoPrimario>
            </div>
          </form>
        </Modal>
      )}
      {confirmar && (
        <Confirmar titulo="Revelar senha" rotulo="Revelar" texto={`Exibir a senha de "${confirmar.platform_name}"? O acesso ficará registrado em seu nome e a senha será ocultada em 30 segundos.`} onConfirm={revelar} onClose={() => setConfirmar(null)} />
      )}
      {del && <Confirmar titulo="Excluir credencial" texto={`Excluir "${del.platform_name}"? A exclusão fica registrada na auditoria.`} onConfirm={excluir} onClose={() => setDel(null)} />}
    </div>
  )
}
