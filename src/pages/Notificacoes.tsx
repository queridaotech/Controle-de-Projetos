import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import clsx from 'clsx'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { PageHeader } from '../components/ui'
import { BotaoSecundario, SemSupabase } from '../components/forms'
import { formatarDataHora } from '../lib/format'

interface Notif { id: string; project_id: string | null; title: string; body: string | null; read_at: string | null; created_at: string }

const avisar = () => window.dispatchEvent(new Event('notificacoes-atualizadas'))

export default function Notificacoes() {
  const nav = useNavigate()
  const toast = useToast()
  const [lista, setLista] = useState<Notif[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.from('notifications').select('id, project_id, title, body, read_at, created_at').order('created_at', { ascending: false }).limit(100)
    setLista((data as Notif[]) ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (!supabase) return <SemSupabase />

  async function abrir(n: Notif) {
    if (!n.read_at) {
      await supabase!.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
      avisar()
    }
    if (n.project_id) nav(`/projetos/${n.project_id}`)
    else carregar()
  }

  async function marcarTodas() {
    const { error } = await supabase!.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
    if (error) toast.erro('Não foi possível atualizar.')
    avisar()
    carregar()
  }

  return (
    <>
      <PageHeader
        title="Notificações"
        subtitle="Prazos, atribuições e mudanças nos seus projetos"
        action={lista.some((n) => !n.read_at) && <BotaoSecundario onClick={marcarTodas}><CheckCheck size={15} />Marcar todas como lidas</BotaoSecundario>}
      />
      <div className="card divide-y divide-line">
        {lista.map((n) => (
          <button key={n.id} onClick={() => abrir(n)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-surface">
            <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-brand')} />
            <div className="min-w-0 flex-1">
              <p className={clsx('text-sm', !n.read_at && 'font-semibold')}>{n.title}</p>
              {n.body && <p className="text-xs text-muted">{n.body}</p>}
            </div>
            <span className="text-xs text-muted">{formatarDataHora(n.created_at)}</span>
          </button>
        ))}
        {!carregando && lista.length === 0 && (
          <div className="p-10 text-center text-sm text-muted"><Bell className="mx-auto mb-2 text-brand" />Nenhuma notificação.</div>
        )}
        {carregando && <div className="p-10 text-center text-sm text-muted">Carregando...</div>}
      </div>
    </>
  )
}
