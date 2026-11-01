import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { Section } from '../../components/ui'
import { BotaoPrimario, input } from '../../components/forms'
import { formatarDataHora } from '../../lib/format'
import type { AbaProps } from './comum'

interface Com { id: string; body: string; author_id: string | null; created_at: string; autor: { full_name: string } | null }

export default function AbaComentarios({ projetoId }: AbaProps) {
  const { perfil, ehAdmin } = useAuth()
  const toast = useToast()
  const [lista, setLista] = useState<Com[]>([])
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(async () => {
    const { data } = await supabase!
      .from('project_comments')
      .select('id, body, author_id, created_at, autor:profiles!project_comments_author_id_fkey(full_name)')
      .eq('project_id', projetoId)
      .order('created_at', { ascending: false })
    setLista((data as unknown as Com[]) ?? [])
  }, [projetoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    setOcupado(true)
    const { error } = await supabase!.from('project_comments').insert({ project_id: projetoId, body: texto.trim(), author_id: perfil!.id })
    setOcupado(false)
    if (error) return toast.erro('Não foi possível registrar o comentário.')
    setTexto('')
    carregar()
  }

  async function excluir(c: Com) {
    const { error } = await supabase!.from('project_comments').delete().eq('id', c.id)
    if (error) toast.erro('Não foi possível excluir.')
    carregar()
  }

  return (
    <Section title="Comentários internos">
      <p className="mb-3 text-xs text-muted">Visíveis apenas para a equipe do projeto e administradores. Nunca aparecem no portal do cliente.</p>
      <form onSubmit={enviar} className="mb-5 space-y-2">
        <textarea rows={3} className={input} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Registre uma informação sobre o processo de homologação..." maxLength={4000} />
        <BotaoPrimario disabled={ocupado || !texto.trim()}>Comentar</BotaoPrimario>
      </form>
      <ul className="divide-y divide-line">
        {lista.map((c) => (
          <li key={c.id} className="py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{c.autor?.full_name ?? 'Usuário removido'}</span>
              <span className="flex items-center gap-2 text-xs text-muted">
                {formatarDataHora(c.created_at)}
                {(c.author_id === perfil?.id || ehAdmin) && (
                  <button onClick={() => excluir(c)} className="rounded p-1 hover:text-red-600" title="Excluir"><Trash2 size={13} /></button>
                )}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
        {lista.length === 0 && <li className="py-6 text-center text-muted">Nenhum comentário.</li>}
      </ul>
    </Section>
  )
}
