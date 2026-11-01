-- =====================================================================
-- 0004: portal externo (somente leitura, sem login)
-- O cliente nunca consulta tabelas internas. A única porta de entrada é
-- get_public_project(token), que devolve um JSON já filtrado.
-- Fora do JSON, por construção: credenciais, comentários, documentos,
-- notas internas, consultores, dados financeiros e outros projetos.
-- =====================================================================

create or replace function public.public_status_label(p_status text)
returns text language sql immutable as $$
  select case p_status
    when 'not_started'       then 'Não iniciado'
    when 'in_progress'       then 'Em andamento'
    when 'internal_review'   then 'Em andamento'
    when 'delayed'           then 'Em andamento'
    when 'waiting_client'    then 'Aguardando documentos do cliente'
    when 'waiting_petrobras' then 'Em análise Petrobras'
    when 'with_pending'      then 'Com pendências'
    when 'completed'         then 'Concluído'
    when 'cancelled'         then 'Encerrado'
    else 'Em andamento' end;
$$;

create or replace function public.get_public_project(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_link public.project_public_links;
  v_set  public.project_public_status;
  v_p    public.projects;
  v_c    public.clients;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;

  select * into v_link from public.project_public_links
  where token = p_token and active and revoked_at is null and (expires_at is null or expires_at > now());
  if not found then return null; end if;

  select * into v_p from public.projects where id = v_link.project_id and archived_at is null;
  if not found then return null; end if;
  select * into v_c from public.clients where id = v_p.client_id;
  select * into v_set from public.project_public_status where project_id = v_p.id;

  return jsonb_build_object(
    'company',        v_c.name,
    'cnpj',           v_c.cnpj,
    'status',         public.public_status_label(v_p.status),
    'progress',       v_p.progress,
    'updated_at',     v_p.updated_at,
    'note',           v_set.public_note,
    'current_stage',  (select s.name from public.project_stages s
                       where s.project_id = v_p.id and s.position = v_p.current_stage_position),
    'next_stage',     (select s.name from public.project_stages s
                       where s.project_id = v_p.id and s.position = v_p.current_stage_position + 1),
    'next_milestone', (select jsonb_build_object('title', m.title,
                              'planned_date', case when v_set.show_dates then m.planned_date end)
                       from public.milestones m
                       where m.project_id = v_p.id and m.status <> 'completed'
                       order by m.planned_date nulls last, m.created_at limit 1),
    'start_date',        case when v_set.show_dates then v_p.start_date end,
    'expected_end_date', case when v_set.show_dates then v_p.expected_end_date end,
    'stages', case when v_set.show_stages then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'position', s.position,
        'name', s.name,
        'description', s.objective,
        'status', case s.status when 'not_started' then 'Não iniciado'
                                when 'in_progress' then 'Em andamento'
                                when 'completed'   then 'Concluído'
                                else 'Com pendências' end,
        'progress', s.progress,
        'start_date',   case when v_set.show_dates then s.start_date end,
        'completed_at', case when v_set.show_dates then s.completed_at end
      ) order by s.position), '[]'::jsonb)
      from public.project_stages s where s.project_id = v_p.id) end,
    'client_pending', case when v_set.show_pending then (
      select coalesce(jsonb_agg(jsonb_build_object('description', i.description, 'due_date', i.due_date)
                                order by i.due_date nulls last), '[]'::jsonb)
      from public.project_pending_items i
      where i.project_id = v_p.id and i.status = 'waiting_client') end,
    'criteria', case when v_set.show_criteria then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', c.name,
        'result', case when c.code = 'gri' and c.gri_level in ('low','medium','high')
                       then 'GRI ' || case c.gri_level when 'low' then 'Baixo' when 'medium' then 'Médio' else 'Alto' end
                       else case c.status when 'not_evaluated' then 'Não avaliado'
                                          when 'in_evaluation' then 'Em avaliação'
                                          when 'approved' then 'Aprovado'
                                          when 'rejected' then 'Reprovado'
                                          else 'Pendente' end end
      ) order by c.created_at), '[]'::jsonb)
      from public.project_criteria c where c.project_id = v_p.id) end,
    'certifications', case when v_set.show_certifications then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'type', case k.cert_type when 'iso_9001' then 'ISO 9001' when 'iso_14001' then 'ISO 14001'
                                 when 'iso_45001' then 'ISO 45001' when 'api' then 'API'
                                 else coalesce(k.other_name, 'Outra') end,
        'identifier', k.identifier,
        'valid_until', k.valid_until,
        'status', case k.status when 'valid' then 'Válida' when 'expired' then 'Vencida'
                                when 'pending' then 'Pendente' else 'Não aplicável' end
      )), '[]'::jsonb)
      from public.project_certifications k where k.project_id = v_p.id) end,
    'crc_number', case when v_set.show_crc_number then v_p.crc_number end
  );
end;
$$;

-- Administradores: gera um novo link (desativa os anteriores) e devolve o token
create or replace function public.create_public_link(p_project uuid, p_valid_days int default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores gerenciam links externos.' using errcode = '42501';
  end if;
  update public.project_public_links set active = false, revoked_at = now()
  where project_id = p_project and active;
  insert into public.project_public_links (project_id, expires_at)
  values (p_project, case when p_valid_days is null then null else now() + make_interval(days => p_valid_days) end)
  returning token into v_token;
  return v_token;
end;
$$;

revoke execute on function public.create_public_link(uuid, int) from public, anon;
grant  execute on function public.create_public_link(uuid, int) to authenticated;
revoke execute on function public.get_public_project(text) from public;
grant  execute on function public.get_public_project(text) to anon, authenticated;
