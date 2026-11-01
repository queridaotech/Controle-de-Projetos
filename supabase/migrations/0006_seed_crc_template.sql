-- =====================================================================
-- 0006: modelo padrão "Homologação CRC Petrobras" (8 etapas, pesos iguais)
-- Novos projetos copiam este modelo; editá-lo depois não altera projetos existentes.
-- =====================================================================

insert into public.project_types (code, name, description)
values ('crc_petrobras', 'Homologação CRC Petrobras',
        'Cadastro e homologação de fornecedores no CRC Petrobras')
on conflict (code) do nothing;

with t as (select id from public.project_types where code = 'crc_petrobras')
insert into public.stage_templates (project_type_id, position, name, objective, milestone_title)
select t.id, v.position, v.name, v.objective, v.milestone
from t, (values
  (1, 'Diagnóstico e Planejamento',
      'Realizar o alinhamento inicial com o cliente e definir a estratégia de homologação.',
      'Diagnóstico concluído'),
  (2, 'Seleção de Linhas de Fornecimento',
      'Identificar as famílias de produtos e serviços que serão cadastradas junto à Petrobras.',
      'Linhas de fornecimento definidas e aprovadas pelo cliente'),
  (3, 'Checklist Documental',
      'Solicitar, receber, analisar e organizar a documentação necessária para a homologação.',
      'Documentação completa'),
  (4, 'Cadastro e Homologação',
      'Realizar o cadastro da empresa e conduzir os procedimentos necessários para sua homologação.',
      'Cadastro submetido'),
  (5, 'Processo de Avaliação Petrobras e Validação Documental',
      'Acompanhar as avaliações e validações realizadas pela Petrobras.',
      'Avaliação Petrobras iniciada'),
  (6, 'Resolução de Pendências',
      'Organizar e acompanhar todas as pendências identificadas durante o processo.',
      null),
  (7, 'Conclusão e Ativação Comercial',
      'Consolidar os resultados da homologação e preparar o fornecedor para sua atuação comercial.',
      'Critérios aprovados'),
  (8, 'Emissão de Certificado',
      'Registrar a conclusão do processo de homologação.',
      'Homologação concluída e certificado registrado')
) as v(position, name, objective, milestone);

with s as (
  select st.id, st.position from public.stage_templates st
  join public.project_types pt on pt.id = st.project_type_id and pt.code = 'crc_petrobras')
insert into public.stage_template_tasks (stage_template_id, position, title)
select s.id, v.pos, v.title
from s join (values
  (1,1,'Reunião de alinhamento inicial'),
  (1,2,'Levantamento das informações da empresa'),
  (1,3,'Identificação do tipo de cadastro'),
  (1,4,'Análise do perfil da empresa'),
  (1,5,'Identificação dos requisitos iniciais'),
  (1,6,'Definição do plano de trabalho'),
  (1,7,'Definição dos responsáveis'),
  (2,1,'Levantamento dos produtos e serviços comercializados'),
  (2,2,'Identificação das famílias de fornecimento'),
  (2,3,'Análise de aderência das famílias'),
  (2,4,'Seleção das famílias estratégicas'),
  (2,5,'Validação das famílias com o cliente'),
  (2,6,'Registro das famílias selecionadas'),
  (3,1,'Enviar checklist documental ao cliente'),
  (3,2,'Receber e conferir documentos'),
  (3,3,'Analisar documentos e solicitar correções'),
  (3,4,'Validar documentação completa'),
  (4,1,'Organização dos documentos'),
  (4,2,'Preparação das informações cadastrais'),
  (4,3,'Preenchimento dos dados da empresa'),
  (4,4,'Cadastro nas plataformas aplicáveis'),
  (4,5,'Submissão das informações'),
  (4,6,'Acompanhamento do protocolo'),
  (4,7,'Registro do número do cadastro, quando disponível'),
  (5,1,'Acompanhar avaliação de cada critério'),
  (5,2,'Registrar pendências identificadas'),
  (6,1,'Tratar pendências abertas junto ao cliente e à Petrobras'),
  (7,1,'Registrar resultado final de cada critério'),
  (7,2,'Registrar famílias efetivamente aprovadas'),
  (7,3,'Registrar certificações e validações aplicáveis'),
  (8,1,'Registrar número do CRC Petrobras e data de emissão'),
  (8,2,'Anexar documentos finais')
) as v(stage_pos, pos, title) on v.stage_pos = s.position;

-- Checklist documental padrão (personalizável por projeto)
with t as (select id from public.project_types where code = 'crc_petrobras')
insert into public.document_checklists (project_type_id, position, name, category, required)
select t.id, v.position, v.name, v.category, v.required
from t, (values
  (1,  'Contrato Social e últimas alterações contratuais, se houver', 'Societário', true),
  (2,  'Demonstrativos financeiros dos dois últimos exercícios', 'Financeiro', true),
  (3,  'Termos de abertura e encerramento dos livros contábeis, quando aplicáveis', 'Contábil', false),
  (4,  'Balanço Patrimonial', 'Financeiro', true),
  (5,  'Demonstração do Resultado do Exercício (DRE)', 'Financeiro', true),
  (6,  'Recibo de entrega da ECD/SPED, quando aplicável', 'Contábil', false),
  (7,  'Declaração de Não Falência (papel timbrado, assinada e carimbada pelo responsável legal)', 'Jurídico', true),
  (8,  'Certidão da Junta Comercial (preferencialmente simplificada)', 'Societário', true),
  (9,  'Atualização das informações de Compliance e Due Diligence', 'Compliance', true),
  (10, 'Código de Ética e Conduta', 'Compliance', true),
  (11, 'Informações sobre canal de denúncias', 'Compliance', true),
  (12, 'Informações sobre políticas de integridade', 'Compliance', true),
  (13, 'Dados bancários: banco, agência e conta', 'Cadastral', true),
  (14, 'Informações dos sócios: nome, telefone, e-mail e participação societária', 'Cadastral', true)
) as v(position, name, category, required);
