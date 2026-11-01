import { Hammer } from 'lucide-react'
import { PageHeader } from '../components/ui'

export default function EmBreve({ titulo }: { titulo: string }) {
  return (
    <>
      <PageHeader title={titulo} />
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <Hammer className="text-brand" />
        <p className="text-sm text-muted">Este módulo será implementado nas próximas fases (banco de dados, gestão de projetos e roadmap).</p>
      </div>
    </>
  )
}
