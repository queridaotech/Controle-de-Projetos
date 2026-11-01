import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, Check, CircleAlert, Users } from 'lucide-react'
import clsx from 'clsx'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { PageHeader, Progress, Section, StatusBadge } from '../components/ui'
import { SemSupabase, input } from '../components/forms'
import { ACAO, ALOCACAO, ENTIDADE, STATUS_ETAPA, STATUS_PROJETO, TIPO_CADASTRO } from '../lib/labels'
import { formatarData, formatarDataHora } from '../lib/format'
import AbaRoadmap from './projeto/AbaRoadmap'
import AbaChecklist from './projeto/AbaChecklist'
import AbaTarefas from './projeto/AbaTarefas'
import AbaPendencias from './projeto/AbaPendencias'
import AbaCriterios from './projeto/AbaCriterios'
import AbaCredenciais from './projeto/AbaCredenciais'
import Certificacoes from './projeto/Certificacoes'
import LinhasProjeto from './projeto/LinhasProjeto'
import AbaComentarios from './projeto/AbaComentarios'
import AbaPortal from './projeto/AbaPortal'

interface Projeto {
  id: string
  name: string
  status: string
  progress: number
  registration_type: string
  start_date: string | null
  expected_end_date: string | null
  actual_end_date: string | null
  crc_number: string | null
  crc_issued_at: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  internal_notes: string | null
  client: { name: string; cnpj: string | null } | null
  project_members: { user_id: string; member_role: string; allocation_role: string; profile: { full_name: string; email: string } | null }[]
}
interface Etapa { id: string; position: number; name: string; status: string; progress: number; due_date: string | null }
interface Marco { id: string; title: string; planned_date: string | null; status: string }
interface Pendencia { id: string; description: string; priority: string; due_date: string | null; status: string }
interface Log {
  id: string
  action: string
  entity_type: string
  created_at: string
  new_data: Record<string, unknown> | null
  old_data: Record<string, unknown> | null
  profile: { full_name: string } | null
}

const ABAS = ['Visão Geral', 'Roadmap', 'Checklist', 'Tarefas', 'Pendências', 'Critérios', 'Comentários', 'Credenciais', 'Portal do cliente', 'Histórico'] as const
type Aba = (typeof ABAS)[number]
const PRIORIDADE: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' }

export default function ProjetoDetalhe() {
  const { id } = useParams()
  const toast = useToast()
  const [p, setP] = useState<Projeto | null>(null)
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [marcos, setMarcos] = useState<Marco[]>([])
  const [pend, setPend] = useState<Pendencia[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [filtroEnt, setFiltroEnt] = useState('')
  const [aba, setAba] = useState<Aba>('Visão Geral')
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'nao_encontrado'>('carregando')

  const carregar = useCallback(async () => {
    if (!supabase || !id) return
    const [pr, et, mi, pe, lg] = await Promise.all([
      supabase
        .from('projects')
        .select('*, client:clients(name, cnpj), project_members(user_id, member_role, allocation_role, profile:profiles!project_members_user_id_fkey(full_name, email))')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('project_stages').select('id, position, name, status, progress, due_date').eq('project_id', id).order('position'),
      supabase.from('milestones').select('id, title, planned_date, status').eq('project_id', id).order('planned_date'),
      supabase
        .from('project_pending_items')
        .select('id, description, priority, due_date, status')
        .eq('project_id', id)
        .in('status', ['open', 'in_progress', 'waiting_client', 'waiting_petrobras'])
        .order('due_date', { nullsFirst: false }),
      supabase
        .from('project_activity_logs')
        .select('id, action, entity_type, created_at, new_data, old_data, profile:profiles(full_name)')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(200),
    ])
    if (!pr.data) return setEstado('nao_encontrado')
    setP(pr.data as unknown as Projeto)
    setEtapas((et.data as Etapa[]) ?? [])
    setMarcos((mi.data as Marco[]) ?? [])
    setPend((pe.data as Pendencia[]) ?? [])
    setLogs((lg.data as unknown as Log[]) ?? [])
    setEstado('ok')
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (!supabase) return <SemSupabase />
  if (estado === 'carregando') return <p className="text-sm text-muted">Carregando...</p>
  if (estado === 'nao_encontrado' || !p)
    return (
      <div className="card p-8 text-center text-sm text-muted">
        Projeto não encontrado ou sem permissão de acesso.
        <div className="mt-3"><Link to="/projetos" className="text-brand-600 hover:underline">Voltar para projetos</Link></div>
      </div>
    )

  async function mudarStatus(novo: string) {
    const { error } = await supabase!.from('projects').update({ status: novo }).eq('id', p!.id)
    if (error) {
      // Mensagens do gatilho de conclusão (ex.: etapas/CRC pendentes) chegam em error.message
      toast.erro(error.message || 'Não foi possível alterar o status.')
    } else {
      toast.ok('Status atualizado.')
    }
    carregar()
  }

  const proximo = marcos.find((m) => m.status !== 'completed')
  const hoje = new Date().toISOString().slice(0, 10)
  const principal = p.project_members.find((m) => m.member_role === 'principal')
  const abaProps = {
    projetoId: p.id,
    equipe: p.project_members.map((m) => ({ id: m.user_id, nome: m.profile?.full_name || m.profile?.email || '—' })),
    recarregar: carregar,
  }
  const entidades = [...new Set(logs.map((l) => l.entity_type))]
  const logsFiltrados = logs.filter((l) => !filtroEnt || l.entity_type === filtroEnt)

  return (
    <>
      <Link to="/projetos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} />Projetos</Link>
      <PageHeader
        title={p.client?.name ?? p.name}
        subtitle={`${p.name} · ${TIPO_CADASTRO[p.registration_type]}${p.client?.cnpj ? ` · ${p.client.cnpj}` : ''}`}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={STATUS_PROJETO[p.status] ?? 'Em andamento'} />
            <select value={p.status} onChange={(e) => mudarStatus(e.target.value)} className={`${input} w-auto`} aria-label="Alterar status">
              {Object.entries(STATUS_PROJETO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        }
      />

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {ABAS.map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={clsx(
              'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm',
              aba === a ? 'border-brand font-medium text-navy-900' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {a}
          </button>
        ))}
      </div>

      {aba === 'Visão Geral' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Section title="Progresso do CRC" action={<Progress value={Math.round(Number(p.progress))} />}>
              <ol className="space-y-3">
                {etapas.map((e) => (
                  <li key={e.id} className="flex items-center gap-3">
                    <span
                      className={clsx(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        e.status === 'completed' && 'bg-emerald-500 text-white',
                        e.status === 'in_progress' && 'bg-brand text-white',
                        e.status === 'blocked' && 'bg-red-500 text-white',
                        e.status === 'not_started' && 'bg-line text-muted',
                      )}
                    >
                      {e.status === 'completed' ? <Check size={14} /> : e.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      <p className="text-xs text-muted">{STATUS_ETAPA[e.status]}{e.due_date && ` · prazo ${formatarData(e.due_date)}`}</p>
                    </div>
                    <Progress value={Math.round(Number(e.progress))} />
                  </li>
                ))}
                {etapas.length === 0 && <p className="text-sm text-muted">Sem etapas.</p>}
              </ol>
            </Section>

            <Section title="Pendências em aberto">
              {pend.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma pendência em aberto.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {pend.map((x) => (
                    <li key={x.id} className="flex items-start gap-3 py-2.5 text-sm">
                      <CircleAlert size={16} className={clsx('mt-0.5 shrink-0', x.due_date && x.due_date < hoje ? 'text-red-500' : 'text-amber-500')} />
                      <span className="flex-1">{x.description}</span>
                      <span className="text-xs text-muted">{PRIORIDADE[x.priority]}{x.due_date && ` · ${formatarData(x.due_date)}`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className="space-y-5">
            <Section title="Resumo">
              <dl className="space-y-2 text-sm">
                {[
                  ['Início', formatarData(p.start_date)],
                  ['Prazo previsto', formatarData(p.expected_end_date)],
                  ['Conclusão real', formatarData(p.actual_end_date)],
                  ['CRC', p.crc_number ? `${p.crc_number} (${formatarData(p.crc_issued_at)})` : 'Não registrado'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
                ))}
              </dl>
            </Section>

            <Section title="Próximo milestone">
              {proximo ? (
                <div className="flex items-start gap-3 text-sm">
                  <CalendarClock size={18} className="mt-0.5 text-brand" />
                  <div>
                    <p className="font-medium">{proximo.title}</p>
                    <p className={clsx('text-xs', proximo.planned_date && proximo.planned_date < hoje ? 'text-red-600' : 'text-muted')}>
                      {formatarData(proximo.planned_date)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">Sem milestones pendentes.</p>
              )}
            </Section>

            <Section title="Equipe">
              <ul className="space-y-2 text-sm">
                {p.project_members.map((m, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Users size={14} className="text-muted" />
                    <span className="flex-1">{m.profile?.full_name || m.profile?.email}</span>
                    <span className="text-xs text-muted">{ALOCACAO[m.allocation_role]}{m.member_role === 'principal' && ' · principal'}</span>
                  </li>
                ))}
                {p.project_members.length === 0 && <li className="text-muted">Sem consultores alocados.</li>}
              </ul>
              {principal === undefined && p.project_members.length > 0 && <p className="mt-2 text-xs text-amber-600">Sem consultor principal.</p>}
            </Section>

            {(p.contact_name || p.contact_email || p.contact_phone) && (
              <Section title="Contato do cliente">
                <p className="text-sm font-medium">{p.contact_name}</p>
                <p className="text-xs text-muted">{[p.contact_email, p.contact_phone].filter(Boolean).join(' · ')}</p>
              </Section>
            )}
          </div>
        </div>
      )}

      {aba === 'Histórico' && (
        <Section
          title="Histórico de alterações"
          action={
            <select value={filtroEnt} onChange={(e) => setFiltroEnt(e.target.value)} className={`${input} w-auto`}>
              <option value="">Todos os tipos</option>
              {entidades.map((e) => <option key={e} value={e}>{ENTIDADE[e] ?? e}</option>)}
            </select>
          }
        >
          {logsFiltrados.length === 0 ? (
            <p className="text-sm text-muted">Nenhum registro.</p>
          ) : (
            <ul className="divide-y divide-line">
              {logsFiltrados.map((l) => {
                const mudou = l.action === 'UPDATE' && l.new_data ? Object.keys(l.new_data).join(', ') : ''
                return (
                  <li key={l.id} className="flex flex-wrap items-baseline gap-x-3 py-2.5 text-sm">
                    <span className="w-32 shrink-0 text-xs text-muted">{formatarDataHora(l.created_at)}</span>
                    <span className="font-medium">{ACAO[l.action] ?? l.action} · {ENTIDADE[l.entity_type] ?? l.entity_type}</span>
                    {mudou && <span className="text-xs text-muted">({mudou})</span>}
                    <span className="ml-auto text-xs text-muted">{l.profile?.full_name ?? 'Sistema'}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      )}

      {aba === 'Roadmap' && <AbaRoadmap {...abaProps} />}
      {aba === 'Checklist' && <AbaChecklist {...abaProps} />}
      {aba === 'Tarefas' && <AbaTarefas {...abaProps} />}
      {aba === 'Pendências' && <AbaPendencias {...abaProps} />}
      {aba === 'Critérios' && (
        <div className="space-y-5">
          <AbaCriterios {...abaProps} />
          <Certificacoes {...abaProps} />
          <LinhasProjeto {...abaProps} />
        </div>
      )}
      {aba === 'Comentários' && <AbaComentarios {...abaProps} />}
      {aba === 'Credenciais' && <AbaCredenciais {...abaProps} />}

      {aba === 'Portal do cliente' && <AbaPortal {...abaProps} />}
    </>
  )
}
