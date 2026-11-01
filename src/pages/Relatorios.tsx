import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageHeader, Progress, Section } from '../components/ui'
import { BotaoSecundario, SemSupabase, input } from '../components/forms'
import { STATUS_PROJETO, TIPO_CADASTRO } from '../lib/labels'
import { formatarData } from '../lib/format'

interface Linha {
  id: string; name: string; status: string; progress: number; registration_type: string
  start_date: string | null; expected_end_date: string | null; actual_end_date: string | null
  crc_number: string | null; current_stage_position: number; archived_at: string | null
  client: { name: string; cnpj: string | null } | null
  project_members: { member_role: string; profile: { full_name: string } | null }[]
}

const FIM = ['completed', 'cancelled']

// Evita injeção de fórmula ao abrir o CSV no Excel
function celula(v: unknown) {
  let t = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t
  return `"${t.replace(/"/g, '""')}"`
}

export default function Relatorios() {
  const [dados, setDados] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [incluirArq, setIncluirArq] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('projects')
      .select('*, client:clients(name, cnpj), project_members(member_role, profile:profiles!project_members_user_id_fkey(full_name))')
      .then(({ data }) => {
        setDados((data as unknown as Linha[]) ?? [])
        setCarregando(false)
      })
  }, [])

  const hoje = new Date().toISOString().slice(0, 10)

  const lista = useMemo(
    () =>
      dados
        .filter((p) => incluirArq || !p.archived_at)
        .filter((p) => !de || (p.start_date ?? '') >= de)
        .filter((p) => !ate || (p.start_date ?? '9999') <= ate)
        .sort((a, b) => (a.client?.name ?? '').localeCompare(b.client?.name ?? '')),
    [dados, de, ate, incluirArq],
  )

  const resumo = useMemo(() => {
    const atrasado = (p: Linha) => !FIM.includes(p.status) && (p.status === 'delayed' || (p.expected_end_date != null && p.expected_end_date < hoje))
    const porStatus: Record<string, number> = {}
    const porConsultor: Record<string, { total: number; ativos: number; atrasados: number }> = {}
    lista.forEach((p) => {
      porStatus[p.status] = (porStatus[p.status] ?? 0) + 1
      const nome = p.project_members.find((m) => m.member_role === 'principal')?.profile?.full_name || 'Sem consultor principal'
      const c = (porConsultor[nome] ??= { total: 0, ativos: 0, atrasados: 0 })
      c.total++
      if (!FIM.includes(p.status)) c.ativos++
      if (atrasado(p)) c.atrasados++
    })
    const concluidos = lista.filter((p) => p.status === 'completed' && p.start_date && p.actual_end_date)
    const dias = concluidos.map((p) => (new Date(p.actual_end_date!).getTime() - new Date(p.start_date!).getTime()) / 86400000)
    return {
      porStatus, porConsultor,
      atrasados: lista.filter(atrasado),
      mediaDias: dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : null,
      progressoMedio: lista.filter((p) => !FIM.includes(p.status)).length
        ? Math.round(lista.filter((p) => !FIM.includes(p.status)).reduce((a, p) => a + Number(p.progress), 0) / lista.filter((p) => !FIM.includes(p.status)).length)
        : 0,
    }
  }, [lista, hoje])

  if (!supabase) return <SemSupabase />

  function exportar() {
    const cab = ['Cliente', 'CNPJ', 'Projeto', 'Tipo de cadastro', 'Consultor principal', 'Status', 'Progresso (%)', 'Etapa atual', 'Início', 'Prazo previsto', 'Conclusão', 'Número CRC']
    const linhas = lista.map((p) => [
      p.client?.name, p.client?.cnpj, p.name, TIPO_CADASTRO[p.registration_type],
      p.project_members.find((m) => m.member_role === 'principal')?.profile?.full_name,
      STATUS_PROJETO[p.status], Math.round(Number(p.progress)), p.current_stage_position,
      formatarData(p.start_date), formatarData(p.expected_end_date), formatarData(p.actual_end_date), p.crc_number,
    ])
    const csv = '﻿' + [cab, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `projetos-petrosupply-${hoje}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Visão consolidada dos projetos que você pode acessar"
        action={<BotaoSecundario onClick={exportar} disabled={lista.length === 0}><Download size={15} />Exportar CSV</BotaoSecundario>}
      />

      <div className="card mb-5 flex flex-wrap items-end gap-4 p-4 text-sm">
        <label>Início de<input type="date" className={`${input} mt-1`} value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label>até<input type="date" className={`${input} mt-1`} value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        <label className="flex items-center gap-2 pb-2 text-muted"><input type="checkbox" checked={incluirArq} onChange={(e) => setIncluirArq(e.target.checked)} />Incluir arquivados</label>
      </div>

      {carregando ? <p className="text-sm text-muted">Carregando...</p> : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              ['Projetos no período', lista.length],
              ['Em atraso', resumo.atrasados.length],
              ['Progresso médio (ativos)', `${resumo.progressoMedio}%`],
              ['Tempo médio de conclusão', resumo.mediaDias == null ? '—' : `${resumo.mediaDias} dias`],
            ].map(([k, v]) => (
              <div key={k} className="card p-4"><p className="text-2xl font-semibold">{v}</p><p className="mt-1 text-xs text-muted">{k}</p></div>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Por status">
              <ul className="divide-y divide-line text-sm">
                {Object.entries(resumo.porStatus).map(([s, n]) => <li key={s} className="flex justify-between py-2"><span>{STATUS_PROJETO[s]}</span><span className="font-medium">{n}</span></li>)}
                {lista.length === 0 && <li className="py-2 text-muted">Sem dados.</li>}
              </ul>
            </Section>
            <Section title="Por consultor principal">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-medium">Consultor</th><th className="font-medium">Total</th><th className="font-medium">Ativos</th><th className="font-medium">Atrasados</th></tr></thead>
                <tbody>
                  {Object.entries(resumo.porConsultor).map(([n, c]) => (
                    <tr key={n} className="border-t border-line"><td className="py-2">{n}</td><td>{c.total}</td><td>{c.ativos}</td><td className={c.atrasados ? 'text-red-600' : ''}>{c.atrasados}</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>

          <Section title="Projetos em atraso">
            {resumo.atrasados.length === 0 ? <p className="text-sm text-muted">Nenhum projeto em atraso.</p> : (
              <ul className="divide-y divide-line text-sm">
                {resumo.atrasados.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <span className="font-medium">{p.client?.name ?? p.name}</span>
                    <span className="text-xs text-muted">previsto {formatarData(p.expected_end_date)}</span>
                    <Progress value={Math.round(Number(p.progress))} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </>
  )
}
