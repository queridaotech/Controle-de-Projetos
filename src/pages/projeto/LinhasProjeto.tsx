import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { Section } from '../../components/ui'
import { BotaoSecundario, input } from '../../components/forms'
import type { AbaProps } from './comum'

interface Vinculo { id: string; family_id: string; status: string; family: { name: string } | null }
const STATUS: Record<string, string> = { selected: 'Selecionada', approved: 'Aprovada', rejected: 'Reprovada', pending: 'Pendente' }

export default function LinhasProjeto({ projetoId }: AbaProps) {
  const toast = useToast()
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [todas, setTodas] = useState<{ id: string; name: string }[]>([])
  const [nova, setNova] = useState('')

  const carregar = useCallback(async () => {
    const [v, t] = await Promise.all([
      supabase!.from('project_supply_families').select('id, family_id, status, family:supply_families(name)').eq('project_id', projetoId).order('created_at'),
      supabase!.from('supply_families').select('id, name').eq('active', true).order('name'),
    ])
    setVinculos((v.data as unknown as Vinculo[]) ?? [])
    setTodas(t.data ?? [])
  }, [projetoId])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function adicionar() {
    if (!nova) return
    const { error } = await supabase!.from('project_supply_families').insert({ project_id: projetoId, family_id: nova })
    if (error) toast.erro(error.code === '23505' ? 'Linha já vinculada.' : 'Não foi possível vincular.')
    setNova('')
    carregar()
  }

  async function mudar(v: Vinculo, status: string) {
    const { error } = await supabase!.from('project_supply_families').update({ status }).eq('id', v.id)
    if (error) toast.erro('Não foi possível atualizar.')
    carregar()
  }

  async function remover(v: Vinculo) {
    const { error } = await supabase!.from('project_supply_families').delete().eq('id', v.id)
    if (error) toast.erro('Não foi possível remover.')
    carregar()
  }

  const livres = todas.filter((t) => !vinculos.some((v) => v.family_id === t.id))

  return (
    <Section title="Linhas de fornecimento do projeto">
      {vinculos.length === 0 ? <p className="mb-3 text-sm text-muted">Nenhuma linha vinculada.</p> : (
        <ul className="mb-4 divide-y divide-line text-sm">
          {vinculos.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="flex-1 font-medium">{v.family?.name}</span>
              <select value={v.status} onChange={(e) => mudar(v, e.target.value)} className={`${input} w-auto py-1`} aria-label={`Situação de ${v.family?.name}`}>
                {Object.entries(STATUS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
              <button onClick={() => remover(v)} className="rounded p-1 text-muted hover:text-red-600" title="Remover"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <select className={`${input} max-w-xs`} value={nova} onChange={(e) => setNova(e.target.value)}>
          <option value="">Adicionar linha...</option>
          {livres.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <BotaoSecundario onClick={adicionar} disabled={!nova}><Plus size={14} />Vincular</BotaoSecundario>
      </div>
    </Section>
  )
}
