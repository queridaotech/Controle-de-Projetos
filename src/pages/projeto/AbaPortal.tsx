import { useCallback, useEffect, useState } from 'react'
import { Copy, ExternalLink, Link2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { Section } from '../../components/ui'
import { Confirmar } from '../../components/Modal'
import { BotaoPrimario, BotaoSecundario, Campo, input } from '../../components/forms'
import { formatarDataHora } from '../../lib/format'
import type { AbaProps } from './comum'

interface Link { id: string; token: string; active: boolean; expires_at: string | null; revoked_at: string | null; created_at: string }
interface Visib {
  show_dates: boolean; show_stages: boolean; show_criteria: boolean; show_certifications: boolean
  show_pending: boolean; show_crc_number: boolean; public_note: string | null
}

const OPCOES: [keyof Visib, string][] = [
  ['show_stages', 'Etapas do processo'],
  ['show_dates', 'Datas e prazos'],
  ['show_pending', 'Pendências do cliente'],
  ['show_criteria', 'Critérios de avaliação'],
  ['show_certifications', 'Certificações'],
  ['show_crc_number', 'Número do CRC'],
]

export default function AbaPortal({ projetoId }: AbaProps) {
  const { ehAdmin } = useAuth()
  const toast = useToast()
  const [links, setLinks] = useState<Link[]>([])
  const [vis, setVis] = useState<Visib | null>(null)
  const [nota, setNota] = useState('')
  const [validade, setValidade] = useState('90')
  const [revogar, setRevogar] = useState<Link | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(async () => {
    const [l, v] = await Promise.all([
      supabase!.from('project_public_links').select('*').eq('project_id', projetoId).order('created_at', { ascending: false }),
      supabase!.from('project_public_status').select('*').eq('project_id', projetoId).maybeSingle(),
    ])
    setLinks((l.data as Link[]) ?? [])
    setVis((v.data as Visib) ?? null)
    setNota(v.data?.public_note ?? '')
  }, [projetoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  const agora = Date.now()
  const ativo = links.find((l) => l.active && !l.revoked_at && (!l.expires_at || new Date(l.expires_at).getTime() > agora))
  const urlDe = (l: Link) => `${window.location.origin}/portal/projeto/${l.token}`

  async function gerar() {
    setOcupado(true)
    const { error } = await supabase!.rpc('create_public_link', { p_project: projetoId, p_valid_days: validade === 'nunca' ? null : Number(validade) })
    setOcupado(false)
    if (error) return toast.erro('Não foi possível gerar o link.')
    toast.ok('Novo link gerado. Os anteriores foram desativados.')
    carregar()
  }

  async function revogarLink() {
    if (!revogar) return
    const { error } = await supabase!.from('project_public_links').update({ active: false, revoked_at: new Date().toISOString() }).eq('id', revogar.id)
    if (error) toast.erro('Não foi possível revogar.')
    else toast.ok('Link revogado.')
    setRevogar(null)
    carregar()
  }

  async function copiar(l: Link) {
    try {
      await navigator.clipboard.writeText(urlDe(l))
      toast.ok('Link copiado.')
    } catch {
      toast.erro('Não foi possível copiar. Selecione e copie manualmente.')
    }
  }

  async function salvarVis(parcial: Partial<Visib>) {
    const { error } = await supabase!.from('project_public_status').update({ ...parcial, updated_at: new Date().toISOString() }).eq('project_id', projetoId)
    if (error) toast.erro('Não foi possível salvar.')
    else if (!('public_note' in parcial)) toast.ok('Visibilidade atualizada.')
    else toast.ok('Mensagem salva.')
    carregar()
  }

  return (
    <div className="space-y-5">
      {ehAdmin ? (
      <Section title="Link do cliente">
        {ativo ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface p-3">
              <Link2 size={16} className="shrink-0 text-brand" />
              <code className="min-w-0 flex-1 break-all text-xs">{urlDe(ativo)}</code>
              <button onClick={() => copiar(ativo)} className="rounded p-1.5 hover:bg-line/50" title="Copiar"><Copy size={16} /></button>
              <a href={urlDe(ativo)} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 hover:bg-line/50" title="Abrir"><ExternalLink size={16} /></a>
            </div>
            <p className="text-xs text-muted">
              Criado em {formatarDataHora(ativo.created_at)} · {ativo.expires_at ? `expira em ${formatarDataHora(ativo.expires_at)}` : 'sem expiração'}
            </p>
            <BotaoSecundario onClick={() => setRevogar(ativo)}>Revogar link</BotaoSecundario>
          </div>
        ) : (
          <p className="text-sm text-muted">Nenhum link ativo. O cliente não consegue acompanhar o projeto até que um link seja gerado.</p>
        )}

        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <Campo rotulo={ativo ? 'Gerar novo link (substitui o atual)' : 'Validade do link'}>
            <select className={`${input} w-auto`} value={validade} onChange={(e) => setValidade(e.target.value)}>
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
              <option value="180">180 dias</option>
              <option value="nunca">Sem expiração</option>
            </select>
          </Campo>
          <BotaoPrimario onClick={gerar} disabled={ocupado}>{ativo ? 'Gerar novo link' : 'Gerar link'}</BotaoPrimario>
        </div>
      </Section>
      ) : (
        <p className="rounded-lg bg-surface p-4 text-xs text-muted">Apenas administradores geram ou revogam o link do cliente. Você pode ajustar o que o portal exibe e a mensagem ao cliente.</p>
      )}

      <Section title="O que o cliente enxerga">
        <p className="mb-3 text-xs text-muted">
          O portal mostra sempre empresa, status geral e progresso. Credenciais, documentos, notas internas, consultores e tarefas nunca são exibidos.
        </p>
        {vis && (
          <div className="grid gap-2 sm:grid-cols-2">
            {OPCOES.map(([k, rotulo]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(vis[k])} onChange={(e) => salvarVis({ [k]: e.target.checked })} />
                {rotulo}
              </label>
            ))}
          </div>
        )}
        <div className="mt-5">
          <Campo rotulo="Mensagem para o cliente (opcional)">
            <textarea rows={3} className={input} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={600} />
          </Campo>
          <div className="mt-2 flex justify-end"><BotaoSecundario onClick={() => salvarVis({ public_note: nota.trim() || null })}>Salvar mensagem</BotaoSecundario></div>
        </div>
      </Section>

      {ehAdmin && links.some((l) => l !== ativo) && (
        <Section title="Links anteriores">
          <ul className="divide-y divide-line text-sm">
            {links.filter((l) => l !== ativo).map((l) => (
              <li key={l.id} className="flex justify-between gap-3 py-2">
                <span className="text-muted">Criado em {formatarDataHora(l.created_at)}</span>
                <span>{l.revoked_at ? 'Revogado' : 'Expirado'}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {revogar && <Confirmar titulo="Revogar link" rotulo="Revogar" texto="O cliente perderá o acesso imediatamente. Você poderá gerar outro link depois." onConfirm={revogarLink} onClose={() => setRevogar(null)} />}
    </div>
  )
}
