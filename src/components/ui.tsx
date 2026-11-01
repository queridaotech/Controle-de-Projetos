import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { Status } from '../lib/data'

export function StatCard({ label, value, icon, tone = 'brand', hint }: {
  label: string; value: number | string; icon: ReactNode; tone?: 'brand' | 'navy' | 'red' | 'amber' | 'green'; hint?: string
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    navy: 'bg-navy-950/10 text-navy-900',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
  }
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tones[tone])}>{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-1.5 truncate text-xs text-muted">{label}</p>
        {hint && <p className="text-[11px] text-muted/80">{hint}</p>}
      </div>
    </div>
  )
}

const statusStyle: Record<Status, string> = {
  'Não iniciado': 'bg-slate-100 text-slate-600',
  'Em andamento': 'bg-brand-50 text-brand-600',
  'Aguardando cliente': 'bg-amber-50 text-amber-700',
  'Aguardando Petrobras': 'bg-indigo-50 text-indigo-700',
  'Em análise interna': 'bg-sky-50 text-sky-700',
  'Com pendências': 'bg-orange-50 text-orange-700',
  'Atrasado': 'bg-red-50 text-red-600',
  'Concluído': 'bg-emerald-50 text-emerald-700',
  'Cancelado': 'bg-slate-100 text-slate-500',
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={clsx('inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium', statusStyle[status])}>{status}</span>
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-brand" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-muted">{value}%</span>
    </div>
  )
}

export function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('card p-5', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
