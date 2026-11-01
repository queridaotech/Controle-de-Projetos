export interface Pessoa { id: string; nome: string }
export interface AbaProps { projetoId: string; equipe: Pessoa[]; recarregar: () => void }

export const PRIORIDADE: Record<string, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' }
export const STATUS_TAREFA: Record<string, string> = { todo: 'A fazer', in_progress: 'Em andamento', blocked: 'Bloqueada', done: 'Concluída' }
export const STATUS_DOC: Record<string, string> = {
  not_requested: 'Não solicitado', requested: 'Solicitado', received: 'Recebido', in_review: 'Em análise',
  approved: 'Aprovado', rejected: 'Rejeitado', needs_fix: 'Precisa de correção', waived: 'Dispensado',
}
export const STATUS_PEND: Record<string, string> = {
  open: 'Aberta', in_progress: 'Em andamento', waiting_client: 'Aguardando cliente',
  waiting_petrobras: 'Aguardando Petrobras', resolved: 'Resolvida', cancelled: 'Cancelada',
}
export const STATUS_CRIT: Record<string, string> = {
  not_evaluated: 'Não avaliado', in_evaluation: 'Em avaliação', approved: 'Aprovado', rejected: 'Reprovado', pending: 'Pendente',
}
export const STATUS_MARCO: Record<string, string> = { pending: 'Pendente', completed: 'Concluído', delayed: 'Atrasado' }
export const GRI: Record<string, string> = { low: 'Baixo', medium: 'Médio', high: 'Alto', not_evaluated: 'Não avaliado' }

export const hojeISO = () => new Date().toISOString().slice(0, 10)
