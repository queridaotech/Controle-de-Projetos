import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { concluidosPorMes as concluidosDemo, projetos as projetosDemo, type Projeto, type Status } from './data'

const STATUS: Record<string, Status> = {
  not_started: 'Não iniciado',
  in_progress: 'Em andamento',
  waiting_client: 'Aguardando cliente',
  waiting_petrobras: 'Aguardando Petrobras',
  internal_review: 'Em análise interna',
  with_pending: 'Com pendências',
  delayed: 'Atrasado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const TIPO: Record<string, string> = {
  reseller_distributor: 'Revendedor / Distribuidor',
  manufacturer_trader: 'Fabricante Comerciante',
  manufacturer_non_trader: 'Fabricante Não Comerciante',
  service_provider: 'Prestador de Serviços',
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface Linha {
  id: string
  status: string
  progress: number
  start_date: string | null
  expected_end_date: string | null
  actual_end_date: string | null
  updated_at: string
  current_stage_position: number
  registration_type: string
  archived_at: string | null
  client: { name: string; cnpj: string | null } | null
  project_members: { member_role: string; profile: { full_name: string } | null }[]
}

export function useProjetos() {
  const [projetos, setProjetos] = useState<Projeto[]>(supabase ? [] : projetosDemo)
  const [concluidosPorMes, setConcluidos] = useState(supabase ? [] : concluidosDemo)
  const [carregando, setCarregando] = useState(Boolean(supabase))
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase
      .from('projects')
      .select(
        `id, status, progress, start_date, expected_end_date, actual_end_date, updated_at,
         current_stage_position, registration_type, archived_at,
         client:clients(name, cnpj),
         project_members(member_role, profile:profiles!project_members_user_id_fkey(full_name))`,
      )
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setErro('Não foi possível carregar os projetos.')
          setCarregando(false)
          return
        }
        const linhas = (data ?? []) as unknown as Linha[]
        setProjetos(
          linhas.map((l) => ({
            id: l.id,
            cliente: l.client?.name ?? '—',
            cnpj: l.client?.cnpj ?? '—',
            consultor:
              l.project_members.find((m) => m.member_role === 'principal')?.profile?.full_name ??
              l.project_members[0]?.profile?.full_name ??
              'Sem consultor',
            etapa: l.current_stage_position,
            status: STATUS[l.status] ?? 'Em andamento',
            progresso: Math.round(Number(l.progress)),
            inicio: l.start_date ?? l.updated_at.slice(0, 10),
            previsao: l.expected_end_date ?? l.updated_at.slice(0, 10),
            atualizado: l.updated_at.slice(0, 10),
            tipo: TIPO[l.registration_type] ?? l.registration_type,
          })),
        )

        // Concluídos por mês: últimos 6 meses
        const hoje = new Date()
        const meses = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1)
          return { chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, mes: MESES[d.getMonth()], valor: 0 }
        })
        linhas.forEach((l) => {
          if (l.status === 'completed' && l.actual_end_date) {
            const m = meses.find((x) => x.chave === l.actual_end_date!.slice(0, 7))
            if (m) m.valor += 1
          }
        })
        setConcluidos(meses.map(({ mes, valor }) => ({ mes, valor })))
        setCarregando(false)
      })
  }, [])

  return { projetos, concluidosPorMes, carregando, erro, demo: !supabase }
}
