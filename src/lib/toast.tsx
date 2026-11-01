import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

interface Aviso {
  id: number
  tipo: 'ok' | 'erro'
  texto: string
}

const Ctx = createContext<{ ok: (t: string) => void; erro: (t: string) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])

  const mostrar = useCallback((tipo: Aviso['tipo'], texto: string) => {
    const id = Date.now() + Math.random()
    setAvisos((a) => [...a, { id, tipo, texto }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 4500)
  }, [])

  return (
    <Ctx.Provider value={{ ok: (t) => mostrar('ok', t), erro: (t) => mostrar('erro', t) }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {avisos.map((a) => (
          <div
            key={a.id}
            className="pointer-events-auto flex max-w-sm items-start gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm shadow-lg"
          >
            {a.tipo === 'ok' ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            ) : (
              <XCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
            )}
            <span>{a.texto}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return c
}
