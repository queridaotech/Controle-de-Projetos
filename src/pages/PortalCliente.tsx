import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarClock, Check, CircleAlert, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'
import { supabase } from '../lib/supabase'
import { formatarData, formatarDataHora } from '../lib/format'

interface Portal {
  company: string
  cnpj: string | null
  status: string
  progress: number
  updated_at: string
  note: string | null
  current_stage: string | null
  next_stage: string | null
  next_milestone: { title: string; planned_date: string | null } | null
  start_date: string | null
  expected_end_date: string | null
  stages: { position: number; name: string; description: string | null; status: string; progress: number }[] | null
  client_pending: { description: string; due_date: string | null }[] | null
  criteria: { name: string; result: string }[] | null
  certifications: { type: string; identifier: string | null; valid_until: string | null; status: string }[] | null
  crc_number: string | null
}

// Página pública e somente leitura. Os dados vêm de um único RPC que já devolve o JSON filtrado.
export default function PortalCliente() {
  const { token } = useParams()
  const [dados, setDados] = useState<Portal | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'invalido'>('carregando')

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    document.title = 'Acompanhamento de projeto · Petrosupply'
    return () => {
      meta.remove()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !token) return setEstado('invalido')
    supabase.rpc('get_public_project', { p_token: token }).then(({ data, error }) => {
      if (error || !data) return setEstado('invalido')
      setDados(data as Portal)
      setEstado('ok')
    })
  }, [token])

  const concluido = dados?.status === 'Concluído'

  return (
    <div className="min-h-full bg-surface">
      <header className="bg-navy-950 px-6 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <img src="/logo-branco.png" alt="Petrosupply" className="h-8" />
          <span className="text-xs text-white/60">Acompanhamento de homologação</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
        {estado === 'carregando' && <p className="text-center text-sm text-muted">Carregando...</p>}

        {estado === 'invalido' && (
          <div className="card p-10 text-center">
            <ShieldCheck className="mx-auto mb-3 text-muted" />
            <p className="font-medium">Link inválido ou expirado</p>
            <p className="mt-1 text-sm text-muted">Solicite um novo link ao seu consultor Petrosupply.</p>
          </div>
        )}

        {estado === 'ok' && dados && (
          <>
            <section className="card p-6">
              <p className="text-xs uppercase tracking-wide text-muted">Cadastro de fornecedor Petrobras (CRC)</p>
              <h1 className="mt-1 text-2xl font-semibold">{dados.company}</h1>
              {dados.cnpj && <p className="text-sm text-muted">CNPJ {dados.cnpj}</p>}

              <div className="mt-5 flex flex-wrap items-center gap-4">
                <span className={clsx('rounded-full px-3 py-1.5 text-sm font-medium', concluido ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-600')}>
                  {dados.status}
                </span>
                <div className="flex min-w-[220px] flex-1 items-center gap-3">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(Number(dados.progress))}%` }} />
                  </div>
                  <span className="text-sm font-semibold">{Math.round(Number(dados.progress))}%</span>
                </div>
              </div>

              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
                {dados.current_stage && <div><dt className="text-muted">Etapa atual</dt><dd className="font-medium">{dados.current_stage}</dd></div>}
                {dados.next_stage && <div><dt className="text-muted">Próxima etapa</dt><dd className="font-medium">{dados.next_stage}</dd></div>}
                {dados.expected_end_date && <div><dt className="text-muted">Previsão de conclusão</dt><dd className="font-medium">{formatarData(dados.expected_end_date)}</dd></div>}
                {dados.crc_number && <div><dt className="text-muted">Número do CRC</dt><dd className="font-medium">{dados.crc_number}</dd></div>}
              </dl>

              {dados.note && <p className="mt-5 rounded-lg bg-surface p-4 text-sm">{dados.note}</p>}
            </section>

            {dados.next_milestone && (
              <section className="card flex items-start gap-3 p-5 text-sm">
                <CalendarClock size={18} className="mt-0.5 text-brand" />
                <div>
                  <p className="text-xs text-muted">Próximo marco</p>
                  <p className="font-medium">{dados.next_milestone.title}</p>
                  {dados.next_milestone.planned_date && <p className="text-xs text-muted">{formatarData(dados.next_milestone.planned_date)}</p>}
                </div>
              </section>
            )}

            {dados.client_pending && dados.client_pending.length > 0 && (
              <section className="card p-5">
                <h2 className="mb-3 text-sm font-semibold">Pendências sob responsabilidade da sua empresa</h2>
                <ul className="divide-y divide-line">
                  {dados.client_pending.map((p, i) => (
                    <li key={i} className="flex items-start gap-3 py-2.5 text-sm">
                      <CircleAlert size={16} className="mt-0.5 shrink-0 text-amber-500" />
                      <span className="flex-1">{p.description}</span>
                      {p.due_date && <span className="text-xs text-muted">até {formatarData(p.due_date)}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {dados.stages && (
              <section className="card p-5">
                <h2 className="mb-4 text-sm font-semibold">Etapas do processo</h2>
                <ol className="space-y-4">
                  {dados.stages.map((s) => (
                    <li key={s.position} className="flex gap-3">
                      <span
                        className={clsx(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                          s.status === 'Concluído' && 'bg-emerald-500 text-white',
                          s.status === 'Em andamento' && 'bg-brand text-white',
                          s.status === 'Com pendências' && 'bg-amber-500 text-white',
                          s.status === 'Não iniciado' && 'bg-line text-muted',
                        )}
                      >
                        {s.status === 'Concluído' ? <Check size={14} /> : s.position}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{s.name} <span className="ml-1 text-xs font-normal text-muted">{s.status}</span></p>
                        {s.description && <p className="text-xs text-muted">{s.description}</p>}
                      </div>
                      {s.status === 'Em andamento' && <span className="text-xs text-muted">{Math.round(Number(s.progress))}%</span>}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {dados.criteria && dados.criteria.length > 0 && (
              <section className="card p-5">
                <h2 className="mb-3 text-sm font-semibold">Critérios de avaliação</h2>
                <ul className="divide-y divide-line text-sm">
                  {dados.criteria.map((c) => (
                    <li key={c.name} className="flex justify-between gap-3 py-2"><span>{c.name}</span><span className="font-medium">{c.result}</span></li>
                  ))}
                </ul>
              </section>
            )}

            {dados.certifications && dados.certifications.length > 0 && (
              <section className="card p-5">
                <h2 className="mb-3 text-sm font-semibold">Certificações</h2>
                <ul className="divide-y divide-line text-sm">
                  {dados.certifications.map((c, i) => (
                    <li key={i} className="flex justify-between gap-3 py-2">
                      <span>{c.type}{c.identifier && ` · ${c.identifier}`}</span>
                      <span className="text-muted">{c.status}{c.valid_until && ` · até ${formatarData(c.valid_until)}`}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="text-center text-xs text-muted">Atualizado em {formatarDataHora(dados.updated_at)} · Somente leitura</p>
          </>
        )}
      </main>
    </div>
  )
}
