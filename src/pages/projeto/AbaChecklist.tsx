import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Paperclip, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { Section } from '../../components/ui'
import { Modal, Confirmar } from '../../components/Modal'
import { BotaoPrimario, BotaoSecundario, Campo, input } from '../../components/forms'
import { formatarDataHora } from '../../lib/format'
import { STATUS_DOC, type AbaProps } from './comum'

interface Doc {
  id: string; name: string; category: string | null; required: boolean; sender: string; status: string
  file_path: string | null; file_name: string | null; file_size: number | null; received_at: string | null; notes: string | null
}

const LIMITE = 25 * 1024 * 1024
const tamanho = (b: number | null) => (b == null ? '' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`)

export default function AbaChecklist({ projetoId, recarregar }: AbaProps) {
  const toast = useToast()
  const [docs, setDocs] = useState<Doc[]>([])
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const [formN, setFormN] = useState({ name: '', category: '', required: true, sender: 'Cliente' })
  const [notas, setNotas] = useState<Doc | null>(null)
  const [textoNotas, setTextoNotas] = useState('')
  const [excluindo, setExcluindo] = useState<Doc | null>(null)
  const seletor = useRef<HTMLInputElement>(null)
  const alvo = useRef<Doc | null>(null)

  const carregar = useCallback(async () => {
    const { data } = await supabase!.from('project_documents').select('*').eq('project_id', projetoId).order('created_at')
    setDocs((data as Doc[]) ?? [])
  }, [projetoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function mudarStatus(d: Doc, status: string) {
    const extra: Record<string, unknown> = {}
    if (status === 'requested' && d.status === 'not_requested') extra.requested_at = new Date().toISOString()
    if (['approved', 'rejected', 'needs_fix'].includes(status)) extra.validated_at = new Date().toISOString()
    const { error } = await supabase!.from('project_documents').update({ status, ...extra }).eq('id', d.id)
    if (error) toast.erro('Não foi possível alterar o status.')
    carregar()
    recarregar()
  }

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    const d = alvo.current
    e.target.value = ''
    if (!arquivo || !d) return
    if (arquivo.size > LIMITE) return toast.erro('O arquivo excede 25 MB.')
    setOcupado(d.id)
    const seguro = arquivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_')
    const caminho = `${projetoId}/${crypto.randomUUID()}-${seguro}`
    const { error: errUp } = await supabase!.storage.from('project-documents').upload(caminho, arquivo, { contentType: arquivo.type || undefined })
    if (errUp) {
      setOcupado(null)
      return toast.erro('Falha no envio. Verifique o tipo e o tamanho do arquivo.')
    }
    const antigo = d.file_path
    const avancar = ['not_requested', 'requested', 'needs_fix', 'rejected'].includes(d.status)
    const { error } = await supabase!.from('project_documents').update({
      file_path: caminho, file_name: arquivo.name, file_size: arquivo.size, mime_type: arquivo.type || null,
      received_at: new Date().toISOString(), ...(avancar ? { status: 'received' } : {}),
    }).eq('id', d.id)
    if (error) {
      await supabase!.storage.from('project-documents').remove([caminho])
      toast.erro('Não foi possível registrar o arquivo.')
    } else {
      if (antigo) await supabase!.storage.from('project-documents').remove([antigo])
      toast.ok('Arquivo anexado.')
    }
    setOcupado(null)
    carregar()
    recarregar()
  }

  async function baixar(d: Doc) {
    if (!d.file_path) return
    const { data, error } = await supabase!.storage.from('project-documents').createSignedUrl(d.file_path, 60, { download: d.file_name ?? true })
    if (error || !data) return toast.erro('Não foi possível gerar o link do arquivo.')
    window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    if (!formN.name.trim()) return toast.erro('Informe o nome do documento.')
    const { error } = await supabase!.from('project_documents').insert({
      project_id: projetoId, name: formN.name.trim(), category: formN.category.trim() || null,
      required: formN.required, sender: formN.sender.trim() || 'Cliente',
    })
    if (error) return toast.erro('Não foi possível adicionar.')
    toast.ok('Documento adicionado.')
    setNovo(false)
    carregar()
    recarregar()
  }

  async function salvarNotas() {
    if (!notas) return
    const { error } = await supabase!.from('project_documents').update({ notes: textoNotas.trim() || null }).eq('id', notas.id)
    if (error) toast.erro('Não foi possível salvar.')
    setNotas(null)
    carregar()
  }

  async function excluir() {
    if (!excluindo) return
    if (excluindo.file_path) await supabase!.storage.from('project-documents').remove([excluindo.file_path])
    const { error } = await supabase!.from('project_documents').delete().eq('id', excluindo.id)
    if (error) toast.erro('Não foi possível excluir.')
    else toast.ok('Documento excluído.')
    setExcluindo(null)
    carregar()
    recarregar()
  }

  const obrigatorios = docs.filter((d) => d.required)
  const ok = obrigatorios.filter((d) => ['approved', 'waived'].includes(d.status)).length

  return (
    <Section
      title={`Checklist documental — ${ok}/${obrigatorios.length} obrigatórios aprovados`}
      action={<BotaoSecundario onClick={() => { setFormN({ name: '', category: '', required: true, sender: 'Cliente' }); setNovo(true) }}><Plus size={14} />Documento</BotaoSecundario>}
    >
      <input ref={seletor} type="file" className="hidden" onChange={enviar} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              {['Documento', 'Envio', 'Status', 'Arquivo', ''].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-b border-line/60 hover:bg-surface">
                <td className="px-3 py-3">
                  <p className="font-medium">{d.name}{!d.required && <span className="ml-2 text-xs font-normal text-muted">(opcional)</span>}</p>
                  {d.category && <p className="text-xs text-muted">{d.category}</p>}
                  {d.notes && <p className="mt-0.5 text-xs text-muted">Obs.: {d.notes}</p>}
                </td>
                <td className="px-3 py-3 text-muted">{d.sender}</td>
                <td className="px-3 py-3">
                  <select value={d.status} onChange={(e) => mudarStatus(d, e.target.value)} className={`${input} w-auto py-1`} aria-label={`Status de ${d.name}`}>
                    {Object.entries(STATUS_DOC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="px-3 py-3">
                  {d.file_path ? (
                    <button onClick={() => baixar(d)} className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                      <Download size={14} />{d.file_name}
                      <span className="text-xs text-muted">({tamanho(d.file_size)}{d.received_at && ` · ${formatarDataHora(d.received_at)}`})</span>
                    </button>
                  ) : <span className="text-muted">—</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">
                  <button
                    disabled={ocupado === d.id}
                    onClick={() => { alvo.current = d; seletor.current?.click() }}
                    className="rounded p-1.5 text-muted hover:bg-line/50 disabled:opacity-50" title={d.file_path ? 'Substituir arquivo' : 'Anexar arquivo'}
                  ><Paperclip size={16} /></button>
                  <button onClick={() => { setNotas(d); setTextoNotas(d.notes ?? '') }} className="rounded px-1.5 py-1 text-xs text-muted hover:bg-line/50">Obs.</button>
                  <button onClick={() => setExcluindo(d)} className="rounded p-1.5 text-muted hover:text-red-600" title="Excluir"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {docs.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted">Sem documentos.</td></tr>}
          </tbody>
        </table>
      </div>

      {novo && (
        <Modal titulo="Novo documento" onClose={() => setNovo(false)}>
          <form onSubmit={criar} className="space-y-4">
            <Campo rotulo="Nome *"><input className={input} value={formN.name} onChange={(e) => setFormN({ ...formN, name: e.target.value })} autoFocus /></Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Categoria"><input className={input} value={formN.category} onChange={(e) => setFormN({ ...formN, category: e.target.value })} /></Campo>
              <Campo rotulo="Quem envia"><input className={input} value={formN.sender} onChange={(e) => setFormN({ ...formN, sender: e.target.value })} /></Campo>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formN.required} onChange={(e) => setFormN({ ...formN, required: e.target.checked })} />Obrigatório</label>
            <div className="flex justify-end gap-2">
              <BotaoSecundario type="button" onClick={() => setNovo(false)}>Cancelar</BotaoSecundario>
              <BotaoPrimario>Adicionar</BotaoPrimario>
            </div>
          </form>
        </Modal>
      )}

      {notas && (
        <Modal titulo={`Observações — ${notas.name}`} onClose={() => setNotas(null)}>
          <textarea rows={4} className={input} value={textoNotas} onChange={(e) => setTextoNotas(e.target.value)} />
          <div className="mt-4 flex justify-end gap-2">
            <BotaoSecundario onClick={() => setNotas(null)}>Cancelar</BotaoSecundario>
            <BotaoPrimario onClick={salvarNotas}>Salvar</BotaoPrimario>
          </div>
        </Modal>
      )}

      {excluindo && <Confirmar titulo="Excluir documento" texto={`Excluir "${excluindo.name}"${excluindo.file_path ? ' e o arquivo anexado' : ''}?`} onConfirm={excluir} onClose={() => setExcluindo(null)} />}
    </Section>
  )
}
