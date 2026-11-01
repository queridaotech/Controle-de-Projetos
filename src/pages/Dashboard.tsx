import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
import { Activity, AlertTriangle, Building2, CheckCircle2, Clock, FileClock, FolderOpen, Users, Landmark } from 'lucide-react'
import { PageHeader, Progress, Section, StatCard, StatusBadge } from '../components/ui'
import { ETAPAS } from '../lib/data'
import { useProjetos } from '../lib/useProjetos'

const CORES = ['#021743', '#00A0DA', '#002254', '#5cc5ea', '#4a6fa5', '#9bdcf3']
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

function contar<T>(lista: T[], chave: (x: T) => string) {
  const m = new Map<string, number>()
  lista.forEach((x) => m.set(chave(x), (m.get(chave(x)) ?? 0) + 1))
  return [...m.entries()].map(([nome, valor]) => ({ nome, valor }))
}

export default function Dashboard() {
  const { projetos, concluidosPorMes, carregando, erro, demo } = useProjetos()
  const [consultor, setConsultor] = useState('')
  const [status, setStatus] = useState('')
  const [etapa, setEtapa] = useState('')
  const [busca, setBusca] = useState('')

  const consultores = [...new Set(projetos.map((p) => p.consultor))]
  const statusLista = [...new Set(projetos.map((p) => p.status))]

  const filtrados = useMemo(
    () =>
      projetos.filter(
        (p) =>
          (!consultor || p.consultor === consultor) &&
          (!status || p.status === status) &&
          (!etapa || p.etapa === Number(etapa)) &&
          (!busca || (p.cliente + p.cnpj).toLowerCase().includes(busca.toLowerCase())),
      ),
    [projetos, consultor, status, etapa, busca],
  )

  const ativos = projetos.filter((p) => p.status !== 'Concluído' && p.status !== 'Cancelado')
  const porEtapa = ETAPAS.map((nome, i) => ({
    nome: `${i + 1}`,
    completo: nome,
    valor: ativos.filter((p) => p.etapa === i + 1).length,
  }))
  const porConsultor = contar(ativos, (p) => p.consultor)
  const porTipo = contar(projetos, (p) => p.tipo)
  const porStatus = contar(projetos, (p) => p.status)
  const atrasados = projetos.filter((p) => p.status === 'Atrasado')

  return (
    <>
      <PageHeader title="Dashboard Executivo" subtitle="Visão consolidada dos projetos de homologação CRC Petrobras" />

      {demo && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Dados de demonstração: o Supabase ainda não está configurado neste ambiente (.env).
        </div>
      )}
      {erro && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>}
      {carregando && <div className="mb-3 text-xs text-muted">Carregando projetos...</div>}
      {!demo && !carregando && !erro && projetos.length === 0 && (
        <div className="card mb-3 p-6 text-center text-sm text-muted">
          Nenhum projeto ainda. Os projetos criados (ou em que você está alocado) aparecerão aqui.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Projetos ativos" value={ativos.length} icon={<FolderOpen size={20} />} tone="navy" />
        <StatCard label="Em andamento" value={projetos.filter((p) => p.status === 'Em andamento').length} icon={<Activity size={20} />} />
        <StatCard label="Atrasados" value={atrasados.length} icon={<AlertTriangle size={20} />} tone="red" />
        <StatCard label="Aguardando documentos" value={projetos.filter((p) => p.status === 'Aguardando cliente').length} icon={<FileClock size={20} />} tone="amber" />
        <StatCard label="Aguardando Petrobras" value={projetos.filter((p) => p.status === 'Aguardando Petrobras').length} icon={<Landmark size={20} />} />
        <StatCard label="Concluídos" value={projetos.filter((p) => p.status === 'Concluído').length} icon={<CheckCircle2 size={20} />} tone="green" />
        <StatCard label="Clientes ativos" value={new Set(ativos.map((p) => p.cliente)).size} icon={<Building2 size={20} />} tone="navy" />
        <StatCard label="Consultores alocados" value={new Set(ativos.map((p) => p.consultor)).size} icon={<Users size={20} />} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Section title="Projetos por etapa do roadmap" className="lg:col-span-2">
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={porEtapa}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e8f0" />
                <XAxis dataKey="nome" tickFormatter={(v) => `Etapa ${v}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip labelFormatter={(_, p) => p?.[0]?.payload.completo} />
                <Bar isAnimationActive={false} dataKey="valor" name="Projetos" fill="#00A0DA" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Projetos por status">
          <div className="h-60">
            <ResponsiveContainer>
              <PieChart>
                <Pie isAnimationActive={false} data={porStatus} dataKey="valor" nameKey="nome" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {porStatus.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span style={{ color: "#0f1b3d" }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Projetos por consultor">
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={porConsultor} layout="vertical">
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar isAnimationActive={false} dataKey="valor" name="Projetos" fill="#002254" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Concluídos por mês">
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={concluidosPorMes}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e3e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip />
                <Bar isAnimationActive={false} dataKey="valor" name="Concluídos" fill="#00A0DA" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="Tipo de cadastro">
          <div className="h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie isAnimationActive={false} data={porTipo} dataKey="valor" nameKey="nome" outerRadius={70}>
                  {porTipo.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span style={{ color: "#0f1b3d" }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      <Section title="Projetos em atraso" className="mt-5">
        {atrasados.length === 0 ? (
          <p className="text-sm text-muted">Nenhum projeto em atraso.</p>
        ) : (
          <ul className="divide-y divide-line">
            {atrasados.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="flex items-center gap-2"><Clock size={15} className="text-red-500" /><Link to={`/projetos/${p.id}`} className="hover:underline">{p.cliente}</Link></span>
                <span className="text-muted">previsão {fmt(p.previsao)} · {p.consultor}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Projetos recentes" className="mt-5">
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cliente ou CNPJ"
            className="rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand" />
          <select value={consultor} onChange={(e) => setConsultor(e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm">
            <option value="">Todos os consultores</option>
            {consultores.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm">
            <option value="">Todos os status</option>
            {statusLista.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={etapa} onChange={(e) => setEtapa(e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm">
            <option value="">Todas as etapas</option>
            {ETAPAS.map((n, i) => <option key={n} value={i + 1}>{i + 1}. {n}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                {['Cliente', 'CNPJ', 'Consultor', 'Etapa atual', 'Status', 'Progresso', 'Início', 'Previsão', 'Atualização'].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.id} className="border-b border-line/60 hover:bg-surface">
                  <td className="px-3 py-3 font-medium"><Link to={`/projetos/${p.id}`} className="hover:underline">{p.cliente}</Link></td>
                  <td className="px-3 py-3 text-muted">{p.cnpj}</td>
                  <td className="px-3 py-3">{p.consultor}</td>
                  <td className="px-3 py-3">{p.etapa}. {ETAPAS[p.etapa - 1]}</td>
                  <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-3 py-3"><Progress value={p.progresso} /></td>
                  <td className="px-3 py-3 text-muted">{fmt(p.inicio)}</td>
                  <td className="px-3 py-3 text-muted">{fmt(p.previsao)}</td>
                  <td className="px-3 py-3 text-muted">{fmt(p.atualizado)}</td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-muted">Nenhum projeto encontrado com esses filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}
