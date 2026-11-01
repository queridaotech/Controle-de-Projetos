import type { ReactNode } from 'react'

export const input =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand disabled:bg-surface'

export function Campo({ rotulo, erro, children, dica }: { rotulo: string; erro?: string; children: ReactNode; dica?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{rotulo}</span>
      {children}
      {dica && !erro && <span className="mt-1 block text-[11px] text-muted">{dica}</span>}
      {erro && <span className="mt-1 block text-xs text-red-600">{erro}</span>}
    </label>
  )
}

export function BotaoPrimario({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-950 disabled:opacity-60"
    >
      {children}
    </button>
  )
}

export function BotaoSecundario({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-surface disabled:opacity-60">
      {children}
    </button>
  )
}

export function SemSupabase() {
  return (
    <div className="card p-8 text-center text-sm text-muted">
      O Supabase não está configurado neste ambiente. Defina as variáveis no arquivo <code>.env</code>.
    </div>
  )
}
