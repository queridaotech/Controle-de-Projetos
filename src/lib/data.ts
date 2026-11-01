// Dados de demonstração usados SOMENTE enquanto o Supabase não estiver configurado (Fase 2 substitui por dados reais).

export const ETAPAS = [
  'Diagnóstico e Planejamento',
  'Linhas de Fornecimento',
  'Checklist Documental',
  'Cadastro e Homologação',
  'Avaliação Petrobras',
  'Resolução de Pendências',
  'Conclusão e Ativação',
  'Emissão de Certificado',
]

export type Status =
  | 'Não iniciado'
  | 'Em andamento'
  | 'Aguardando cliente'
  | 'Aguardando Petrobras'
  | 'Em análise interna'
  | 'Com pendências'
  | 'Atrasado'
  | 'Concluído'
  | 'Cancelado'

export interface Projeto {
  id: string
  cliente: string
  cnpj: string
  consultor: string
  etapa: number
  status: Status
  progresso: number
  inicio: string
  previsao: string
  atualizado: string
  tipo: string
}

export const projetos: Projeto[] = [
  { id: '1', cliente: 'Atlântico Válvulas Ltda', cnpj: '12.345.678/0001-90', consultor: 'Marina Costa', etapa: 3, status: 'Aguardando cliente', progresso: 38, inicio: '2026-08-04', previsao: '2026-12-15', atualizado: '2026-10-30', tipo: 'Fabricante Comerciante' },
  { id: '2', cliente: 'Macaé Offshore Serviços', cnpj: '23.456.789/0001-01', consultor: 'Rafael Lima', etapa: 5, status: 'Aguardando Petrobras', progresso: 64, inicio: '2026-06-10', previsao: '2026-11-30', atualizado: '2026-10-29', tipo: 'Prestador de Serviços' },
  { id: '3', cliente: 'Norte Fluxo Distribuidora', cnpj: '34.567.890/0001-12', consultor: 'Marina Costa', etapa: 6, status: 'Com pendências', progresso: 72, inicio: '2026-05-20', previsao: '2026-11-10', atualizado: '2026-10-28', tipo: 'Revendedor / Distribuidor' },
  { id: '4', cliente: 'Petroforja Metalúrgica', cnpj: '45.678.901/0001-23', consultor: 'Carlos Menezes', etapa: 2, status: 'Em andamento', progresso: 22, inicio: '2026-09-15', previsao: '2027-01-20', atualizado: '2026-10-27', tipo: 'Fabricante Não Comerciante' },
  { id: '5', cliente: 'Sul Naval Engenharia', cnpj: '56.789.012/0001-34', consultor: 'Rafael Lima', etapa: 4, status: 'Atrasado', progresso: 51, inicio: '2026-04-02', previsao: '2026-10-15', atualizado: '2026-10-25', tipo: 'Prestador de Serviços' },
  { id: '6', cliente: 'Delta Bombas Industriais', cnpj: '67.890.123/0001-45', consultor: 'Carlos Menezes', etapa: 8, status: 'Concluído', progresso: 100, inicio: '2026-02-10', previsao: '2026-09-30', atualizado: '2026-10-20', tipo: 'Fabricante Comerciante' },
  { id: '7', cliente: 'Baía Tubos e Conexões', cnpj: '78.901.234/0001-56', consultor: 'Marina Costa', etapa: 1, status: 'Não iniciado', progresso: 4, inicio: '2026-10-26', previsao: '2027-03-01', atualizado: '2026-10-26', tipo: 'Revendedor / Distribuidor' },
  { id: '8', cliente: 'Campos Automação', cnpj: '89.012.345/0001-67', consultor: 'Rafael Lima', etapa: 8, status: 'Concluído', progresso: 100, inicio: '2026-01-12', previsao: '2026-08-30', atualizado: '2026-09-18', tipo: 'Fabricante Comerciante' },
]

export const porStatus = [
  { nome: 'Em andamento', valor: 1 },
  { nome: 'Aguardando cliente', valor: 1 },
  { nome: 'Aguardando Petrobras', valor: 1 },
  { nome: 'Com pendências', valor: 1 },
  { nome: 'Atrasado', valor: 1 },
  { nome: 'Concluído', valor: 2 },
  { nome: 'Não iniciado', valor: 1 },
]

export const concluidosPorMes = [
  { mes: 'Mai', valor: 1 }, { mes: 'Jun', valor: 0 }, { mes: 'Jul', valor: 2 },
  { mes: 'Ago', valor: 1 }, { mes: 'Set', valor: 2 }, { mes: 'Out', valor: 1 },
]
