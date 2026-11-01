import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({
  titulo, onClose, children, largo,
}: { titulo: string; onClose: () => void; children: ReactNode; largo?: boolean }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/50 p-4 sm:p-8" onMouseDown={onClose}>
      <div
        className={`card w-full ${largo ? 'max-w-2xl' : 'max-w-lg'} bg-white p-6`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:bg-surface" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Confirmar({
  titulo, texto, rotulo = 'Excluir', onConfirm, onClose, carregando,
}: { titulo: string; texto: string; rotulo?: string; onConfirm: () => void; onClose: () => void; carregando?: boolean }) {
  return (
    <Modal titulo={titulo} onClose={onClose}>
      <p className="text-sm text-muted">{texto}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-surface">Cancelar</button>
        <button
          onClick={onConfirm}
          disabled={carregando}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {carregando ? 'Aguarde...' : rotulo}
        </button>
      </div>
    </Modal>
  )
}
