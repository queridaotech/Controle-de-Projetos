import { useEffect, useMemo, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageHeader, Section } from '../components/ui'
import { SemSupabase, input } from '../components/forms'
import { formatarDataHora } from '../lib/format'

interface Log { id: string; action: string; detail: string | null; created_at: string; user_id: string | null; project_id: string | null }

const ROTULO: Record<string, string> = {
  create: 'Criou credencial', update: 'Alterou credencial', reveal: 'Visualizou senha', delete: 'Excluiu credencial',
  denied_reveal: 'Tentativa negada: ver senha', denied_save: 'Tentativa negada: salvar', denied_delete: 'Tentativa negada: excluir',
}

export default function Configuracoes() {
  const [logs, setLogs] = useState<Log[]>([])
  const [pessoas, setPessoas] = useState<Record<string, string>>({})
  const [projetos, setProjetos] = useState<Record<string, string>>({})
  const [filtro, setFiltro] = useState('negadas')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!supabase) return
    Promise.all([
      supabase.from('credential_access_logs').select('id, action, detail, created_at, user_id, project_id').order('created_at', { ascending: false }).limit(500),
      supabase.from('profiles').select('id, full_name, email'),
      supabase.from('projects').select('id, name, client:clients(name)'),
    ]).then(([l, p, pr]) => {
      setLogs((l.data as Log[]) ?? [])
      setPessoas(Object.fromEntries((p.data ?? []).map((x) => [x.id, x.full_name || x.email])))
      setProjetos(Object.fromEntries(((pr.data ?? []) as unknown as { id: string; name: string; client: { name: string } | null }[]).map((x) => [x.id, x.client?.name ?? x.name])))
      setCarregando(false)
    })
  }, [])

  const exibidos = useMemo(
    () => logs.filter((l) => (filtro === 'negadas' ? l.action.startsWith('denied') : true)),
    [logs, filtro],
  )
  const totalNegadas = logs.filter((l) => l.action.startsWith('denied')).length

  if (!supabase) return <SemSupabase />

  return (
    <>
      <PageHeader title="Configurações" subtitle="Segurança e auditoria da plataforma" />
      <Section
        title={`Auditoria de credenciais — ${totalNegadas} tentativa(s) negada(s) no histórico recente`}
        action={
          <select className={`${input} w-auto py-1`} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="negadas">Somente tentativas negadas</option>
            <option value="todas">Todos os acessos</option>
          </select>
        }
      >
        <p className="mb-4 flex items-center gap-2 text-xs text-muted">
          <ShieldAlert size={14} />Toda visualização, alteração, exclusão e tentativa negada de acesso a senhas fica registrada com usuário, projeto, data e horário.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                {['Quando', 'Quem', 'Projeto', 'Ocorrência'].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {exibidos.map((l) => (
                <tr key={l.id} className={`border-b border-line/60 ${l.action.startsWith('denied') ? 'text-red-600' : ''}`}>
                  <td className="whitespace-nowrap px-3 py-2.5">{formatarDataHora(l.created_at)}</td>
                  <td className="px-3 py-2.5">{l.user_id ? pessoas[l.user_id] ?? 'Usuário removido' : '—'}</td>
                  <td className="px-3 py-2.5">{l.project_id ? projetos[l.project_id] ?? 'Projeto removido' : '—'}</td>
                  <td className="px-3 py-2.5">{ROTULO[l.action]}{l.detail && <span className="text-muted"> ({l.detail})</span>}</td>
                </tr>
              ))}
              {!carregando && exibidos.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted">Nenhum registro.</td></tr>}
              {carregando && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted">Carregando...</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}
