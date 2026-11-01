-- =====================================================================
-- 0002: funções auxiliares, triggers, progresso, auditoria e notificações
-- =====================================================================

-- ---------- Helpers de permissão (SECURITY DEFINER evita recursão de RLS) ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active);
$$;

create or replace function public.is_project_member(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.project_members m
    join public.profiles u on u.id = m.user_id
    where m.project_id = p_project and m.user_id = auth.uid() and u.active
  );
$$;

create or replace function public.can_access_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_project is not null and (public.is_admin() or public.is_project_member(p_project));
$$;

-- ---------- updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
      and table_name in (select table_name from information_schema.tables
                         where table_schema = 'public' and table_type = 'BASE TABLE')
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------- Novo usuário => perfil (o primeiro usuário vira administrador) ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'consultant' else 'admin' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Somente administradores alteram papel/ativação (auth.uid() nulo = service role / SQL editor)
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.role is distinct from old.role or new.active is distinct from old.active) then
    raise exception 'Apenas administradores podem alterar perfil de acesso ou ativação.';
  end if;
  return new;
end;
$$;

create trigger guard_profile_update before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------- Projeto: valores padrão, regras de conclusão e herança do modelo ----------
create or replace function public.projects_before_write()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.project_type_id is null then
      select id into new.project_type_id from public.project_types where code = 'crc_petrobras';
    end if;
  end if;

  if new.expected_end_date is null and new.start_date is not null and new.estimated_days is not null then
    new.expected_end_date = new.start_date + new.estimated_days;
  end if;

  if tg_op = 'UPDATE' and new.status = 'completed' and old.status is distinct from 'completed' then
    if exists (select 1 from public.project_stages
               where project_id = new.id and required and status <> 'completed') then
      raise exception 'Não é possível concluir o projeto: há etapas obrigatórias não finalizadas.';
    end if;
    new.actual_end_date = coalesce(new.actual_end_date, current_date);
  end if;
  return new;
end;
$$;

create trigger projects_before_write before insert or update on public.projects
  for each row execute function public.projects_before_write();

-- Copia etapas, tarefas, milestones, checklist e critérios do modelo. Mudanças futuras no
-- modelo NÃO afetam projetos já criados, pois tudo é copiado.
create or replace function public.init_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_stages (project_id, template_id, position, name, objective, description, weight, required)
  select new.id, st.id, st.position, st.name, st.objective, st.description, st.weight, st.required
  from public.stage_templates st
  where st.project_type_id = new.project_type_id and st.active;

  insert into public.project_tasks (project_id, stage_id, title, description)
  select new.id, ps.id, tt.title, tt.description
  from public.stage_template_tasks tt
  join public.project_stages ps on ps.template_id = tt.stage_template_id and ps.project_id = new.id
  order by ps.position, tt.position;

  insert into public.milestones (project_id, stage_id, title)
  select new.id, ps.id, st.milestone_title
  from public.stage_templates st
  join public.project_stages ps on ps.template_id = st.id and ps.project_id = new.id
  where st.milestone_title is not null;

  insert into public.project_documents (project_id, checklist_item_id, name, category, required)
  select new.id, dc.id, dc.name, dc.category, dc.required
  from public.document_checklists dc
  where dc.project_type_id = new.project_type_id and dc.active
  order by dc.position;

  if exists (select 1 from public.project_types where id = new.project_type_id and code = 'crc_petrobras') then
    insert into public.project_criteria (project_id, code, name) values
      (new.id, 'managerial',          'Gerencial'),
      (new.id, 'family_registration', 'Registro de Famílias'),
      (new.id, 'legal',               'Critério Legal'),
      (new.id, 'economic',            'Critério Econômico'),
      (new.id, 'gri',                 'GRI — Integridade'),
      (new.id, 'technical',           'Critério Técnico'),
      (new.id, 'lfo',                 'LFO'),
      (new.id, 'certifications',      'Validações e Certificações');
  end if;

  insert into public.project_public_status (project_id) values (new.id) on conflict do nothing;

  if auth.uid() is not null then
    insert into public.project_members (project_id, user_id, member_role)
    select new.id, auth.uid(), 'auxiliary'
    where not public.is_admin()
    on conflict do nothing;
  end if;

  insert into public.project_activity_logs (project_id, user_id, action, entity_type, entity_id, new_data)
  values (new.id, auth.uid(), 'INSERT', 'projects', new.id,
          jsonb_build_object('name', new.name, 'status', new.status));
  return new;
end;
$$;

create trigger init_project after insert on public.projects
  for each row execute function public.init_project();

-- ---------- Progresso (regra do item 13) ----------
-- Etapa concluída = 100%; não iniciada = 0%; em andamento = % de tarefas concluídas.
-- Projeto = média ponderada pelos pesos das etapas.
create or replace function public.recalc_project_progress(p_project uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.project_stages s
  set progress = case s.status
    when 'completed'   then 100
    when 'not_started' then 0
    else coalesce((
      select round(100.0 * count(*) filter (where t.status = 'done') / nullif(count(*), 0), 2)
      from public.project_tasks t where t.stage_id = s.id), 0)
  end
  where s.project_id = p_project;

  update public.projects p
  set progress = coalesce((
        select round(sum(s.progress * s.weight) / nullif(sum(s.weight), 0), 2)
        from public.project_stages s where s.project_id = p_project), 0),
      current_stage_position = coalesce(
        (select min(s.position) from public.project_stages s where s.project_id = p_project and s.status <> 'completed'),
        (select max(s.position) from public.project_stages s where s.project_id = p_project),
        1)
  where p.id = p_project;
end;
$$;

create or replace function public.trg_recalc_progress()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_project uuid;
begin
  v_project := coalesce(new.project_id, old.project_id);
  perform public.recalc_project_progress(v_project);
  return null;
end;
$$;

-- "of status, weight" impede laço: o recálculo só altera a coluna progress
create trigger recalc_after_stage after insert or delete or update of status, weight on public.project_stages
  for each row execute function public.trg_recalc_progress();
create trigger recalc_after_task after insert or delete or update of status, stage_id on public.project_tasks
  for each row execute function public.trg_recalc_progress();

-- Carimbos automáticos de datas
create or replace function public.stamp_completion()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'project_stages' then
    if new.status = 'completed' and old.status is distinct from 'completed' then new.completed_at = now();
    elsif new.status <> 'completed' then new.completed_at = null; end if;
    if new.status = 'in_progress' and new.start_date is null then new.start_date = current_date; end if;
  elsif tg_table_name = 'project_tasks' then
    if new.status = 'done' and old.status is distinct from 'done' then new.completed_at = now();
    elsif new.status <> 'done' then new.completed_at = null; end if;
  elsif tg_table_name = 'milestones' then
    if new.completed_at is not null then new.status = 'completed';
    elsif new.status = 'completed' then new.completed_at = now(); end if;
  elsif tg_table_name = 'project_pending_items' then
    if new.status = 'resolved' and old.status is distinct from 'resolved' then new.resolved_at = now();
    elsif new.status <> 'resolved' then new.resolved_at = null; end if;
  elsif tg_table_name = 'project_criteria' then
    new.last_updated_at = current_date;
    if new.status = 'in_evaluation' and new.started_at is null then new.started_at = current_date; end if;
  elsif tg_table_name = 'project_documents' then
    if new.status is distinct from old.status then
      if new.status = 'requested' and new.requested_at is null then new.requested_at = now(); end if;
      if new.status = 'received'  and new.received_at  is null then new.received_at  = now(); end if;
      if new.status in ('approved','rejected','needs_fix') then new.validated_at = now(); end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger stamp_completion before update on public.project_stages
  for each row execute function public.stamp_completion();
create trigger stamp_completion before update on public.project_tasks
  for each row execute function public.stamp_completion();
create trigger stamp_completion before update on public.milestones
  for each row execute function public.stamp_completion();
create trigger stamp_completion before update on public.project_pending_items
  for each row execute function public.stamp_completion();
create trigger stamp_completion before update on public.project_criteria
  for each row execute function public.stamp_completion();
create trigger stamp_completion before update on public.project_documents
  for each row execute function public.stamp_completion();

-- ---------- Auditoria automática (item 10) ----------
-- Registra apenas colunas alteradas. Operações disparadas por outros triggers
-- (herança do modelo, recálculo de progresso) não geram ruído.
create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb; v_old jsonb; v_new jsonb; v_pid uuid;
  v_ignore text[] := array['updated_at','created_at','progress','current_stage_position','password_enc'];
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    v_row := to_jsonb(old); v_old := v_row;
  elsif tg_op = 'INSERT' then
    v_row := to_jsonb(new); v_new := v_row;
  else
    v_row := to_jsonb(new);
    select jsonb_object_agg(e.key, e.value) into v_new
    from jsonb_each(v_row) e
    where to_jsonb(old) -> e.key is distinct from e.value and e.key <> all (v_ignore);
    if v_new is null then
      return new;
    end if;
    select jsonb_object_agg(k, to_jsonb(old) -> k) into v_old from jsonb_object_keys(v_new) k;
  end if;

  v_pid := case when tg_table_name = 'projects' then (v_row ->> 'id')::uuid
                else (v_row ->> 'project_id')::uuid end;

  insert into public.project_activity_logs (project_id, user_id, action, entity_type, entity_id, old_data, new_data)
  values (v_pid, auth.uid(), tg_op, tg_table_name, (v_row ->> 'id')::uuid, v_old, v_new);
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'project_members','project_stages','project_tasks','milestones','project_documents',
    'project_criteria','project_certifications','project_pending_items','project_public_links',
    'project_supply_families'
  ] loop
    execute format('create trigger log_activity after insert or update or delete on public.%I
                    for each row execute function public.log_activity()', t);
  end loop;
end $$;

-- projects: a criação é registrada em init_project(); exclusão não é logada (o log cascateia junto)
create trigger log_activity after update on public.projects
  for each row execute function public.log_activity();

-- ---------- Notificações (item 12) ----------
create or replace function public.notify_user(p_user uuid, p_project uuid, p_type text, p_title text, p_body text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user is not distinct from auth.uid() then return; end if;
  insert into public.notifications (user_id, project_id, type, title, body) values (p_user, p_project, p_type, p_title, p_body);
end;
$$;

create or replace function public.notify_members(p_project uuid, p_type text, p_title text, p_body text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select m.user_id from public.project_members m join public.profiles u on u.id = m.user_id
           where m.project_id = p_project and u.active loop
    perform public.notify_user(r.user_id, p_project, p_type, p_title, p_body);
  end loop;
end;
$$;

create or replace function public.trg_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if tg_table_name = 'project_members' then
    select name into v_name from public.projects where id = new.project_id;
    perform public.notify_user(new.user_id, new.project_id, 'project_assigned', 'Você foi alocado em um projeto', v_name);

  elsif tg_table_name = 'project_tasks' then
    if new.assigned_to is not null and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
      perform public.notify_user(new.assigned_to, new.project_id, 'task_assigned', 'Nova tarefa atribuída', new.title);
    end if;

  elsif tg_table_name = 'project_documents' then
    if new.status is distinct from old.status then
      if new.status = 'received' then
        perform public.notify_members(new.project_id, 'document_received', 'Documento recebido', new.name);
      elsif new.status = 'rejected' then
        perform public.notify_members(new.project_id, 'document_rejected', 'Documento reprovado', new.name);
      end if;
    end if;

  elsif tg_table_name = 'project_pending_items' then
    if tg_op = 'INSERT' then
      perform public.notify_members(new.project_id, 'pending_created', 'Nova pendência registrada', left(new.description, 140));
    elsif new.status = 'resolved' and old.status is distinct from 'resolved' then
      perform public.notify_members(new.project_id, 'pending_resolved', 'Pendência resolvida', left(new.description, 140));
    end if;

  elsif tg_table_name = 'milestones' then
    if new.status = 'completed' and old.status is distinct from 'completed' then
      perform public.notify_members(new.project_id, 'milestone_completed', 'Milestone concluído', new.title);
    end if;

  elsif tg_table_name = 'project_criteria' then
    if new.status is distinct from old.status then
      perform public.notify_members(new.project_id, 'criterion_updated', 'Critério atualizado: ' || new.name, new.status);
    end if;

  elsif tg_table_name = 'projects' then
    if new.crc_number is not null and old.crc_number is null then
      perform public.notify_members(new.id, 'crc_issued', 'CRC emitido', new.crc_number);
    end if;
    if new.status = 'delayed' and old.status is distinct from 'delayed' then
      perform public.notify_members(new.id, 'project_delayed', 'Projeto marcado como atrasado', new.name);
    end if;
  end if;
  return null;
end;
$$;

create trigger notify after insert on public.project_members for each row execute function public.trg_notify();
create trigger notify after insert or update of assigned_to on public.project_tasks for each row execute function public.trg_notify();
create trigger notify after update of status on public.project_documents for each row execute function public.trg_notify();
create trigger notify after insert or update of status on public.project_pending_items for each row execute function public.trg_notify();
create trigger notify after update of status on public.milestones for each row execute function public.trg_notify();
create trigger notify after update of status on public.project_criteria for each row execute function public.trg_notify();
create trigger notify after update of crc_number, status on public.projects for each row execute function public.trg_notify();

-- Alertas de prazo: agendar diariamente (pg_cron ou Edge Function agendada). Sem duplicar no mesmo dia.
create or replace function public.generate_deadline_notifications()
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  for r in
    select t.assigned_to as user_id, t.project_id, t.title, t.due_date
    from public.project_tasks t
    where t.status <> 'done' and t.assigned_to is not null
      and t.due_date between current_date and current_date + 3
      and not exists (select 1 from public.notifications n2
                      where n2.user_id = t.assigned_to and n2.type = 'deadline_near'
                        and n2.body = t.title and n2.created_at::date = current_date)
  loop
    insert into public.notifications (user_id, project_id, type, title, body)
    values (r.user_id, r.project_id, 'deadline_near', 'Prazo próximo (' || to_char(r.due_date, 'DD/MM') || ')', r.title);
    n := n + 1;
  end loop;

  for r in
    select m.user_id, p.id as project_id, p.name
    from public.projects p
    join public.project_members m on m.project_id = p.id
    where p.status not in ('completed','cancelled') and p.archived_at is null
      and p.expected_end_date < current_date
      and not exists (select 1 from public.notifications n2
                      where n2.user_id = m.user_id and n2.type = 'project_overdue'
                        and n2.project_id = p.id and n2.created_at::date = current_date)
  loop
    insert into public.notifications (user_id, project_id, type, title, body)
    values (r.user_id, r.project_id, 'project_overdue', 'Projeto com prazo vencido', r.name);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function public.generate_deadline_notifications() from public, anon, authenticated;
