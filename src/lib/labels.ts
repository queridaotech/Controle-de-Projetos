import type { Status } from './data'

export const STATUS_PROJETO: Record<string, Status> = {
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

export const TIPO_CADASTRO: Record<string, string> = {
  reseller_distributor: 'Revendedor / Distribuidor',
  manufacturer_trader: 'Fabricante Comerciante',
  manufacturer_non_trader: 'Fabricante Não Comerciante',
  service_provider: 'Prestador de Serviços',
}

export const PAPEL: Record<string, string> = {
  admin: 'Administrador',
  consultant: 'Consultor',
}

export const STATUS_ETAPA: Record<string, string> = {
  not_started: 'Não iniciada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  blocked: 'Bloqueada',
}

export const ENTIDADE: Record<string, string> = {
  projects: 'Projeto',
  project_members: 'Alocação',
  project_stages: 'Etapa',
  project_tasks: 'Tarefa',
  milestones: 'Milestone',
  project_documents: 'Documento',
  project_criteria: 'Critério',
  project_certifications: 'Certificação',
  project_pending_items: 'Pendência',
  project_public_links: 'Link externo',
  project_supply_families: 'Linha de fornecimento',
  project_comments: 'Comentário',
  project_public_status: 'Portal do cliente',
}

export const ACAO: Record<string, string> = { INSERT: 'Criação', UPDATE: 'Alteração', DELETE: 'Exclusão' }

export const ALOCACAO: Record<string, string> = {
  responsible: 'Consultor responsável',
  auxiliary: 'Consultor auxiliar',
  acting_admin: 'Administrador atuante',
}
