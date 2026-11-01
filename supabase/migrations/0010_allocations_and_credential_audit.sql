-- =====================================================================
-- 0010: alocações flexíveis, administrador atuante, auditoria de credenciais
-- =====================================================================

-- ---------- Perfis: atuação operacional e alocação automática ----------
alter table public.profiles
  add column if not exists can_operate boolean not null default true,
  add column if not exists auto_assign_new_projects boolean not null default false;

create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
       new.role is distinct from old.role
    or new.active is distinct from old.active
    or new.can_operate is distinct from old.can_operate
    or new.auto_assign_new_projects is distinct from old.auto_assign_new_projects) then
    raise exception 'Apenas administradores podem alterar perfil de acesso, ativação ou atuação operacional.';
  end if;
  if new.can_operate = false and old.can_operate
     and exists (select 1 from public.project_members where user_id = new.id) then
    raise exception 'Remova as alocações deste usuário antes de desabilitar a atuação operacional.';
  end if;
  if not new.can_operate then
    new.auto_assign_new_projects := false;
  end if;
  return new;
end;
$$;

-- ---------- project_members: estrutura de alocação ----------
alter table public.project_members
  add column if not exists allocation_role text,
  add column if not exists is_primary boolean generated always as (member_role = 'principal') stored,
  add column if not exists assigned_by uuid references public.profiles(id) on delete set null,
  add column if not exists assigned_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.project_members m
set assigned_by = m.created_by,
    assigned_at = m.created_at,
    allocation_role = case when u.role = 'admin' then 'acting_admin'
                           when m.member_role = 'principal' then 'responsible'
                           else 'auxiliary' end
from public.profiles u
where u.id = m.user_id and m.allocation_role is null;

alter table public.project_members alter column allocation_role set not null;
alter table public.project_members
  add constraint project_members_allocation_role_check
  check (allocation_role in ('responsible', 'auxiliary', 'acting_admin'));

create or replace function public.members_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role text; v_active boolean; v_op boolean;
begin
  if tg_op = 'INSERT' or new.user_id is distinct from old.user_id then
    select role, active, can_operate into v_role, v_active, v_op from public.profiles where id = new.user_id;
    if not found or not v_active then
      raise exception 'Usuário desativado não pode ser alocado a projetos.';
    end if;
    if not v_op then
      raise exception 'Este usuário não está habilitado para atuar operacionalmente nos projetos.';
    end if;
  else
    select role into v_role from public.profiles where id = new.user_id;
  end if;

  if tg_op = 'INSERT' then
    new.assigned_by := coalesce(new.assigned_by, auth.uid());
    new.assigned_at := now();
  else
    new.updated_at := now();
  end if;

  if new.allocation_role is null
     or (tg_op = 'UPDATE' and new.member_role is distinct from old.member_role
         and new.allocation_role is not distinct from old.allocation_role) then
    new.allocation_role := case when v_role = 'admin' then 'acting_admin'
                                when new.member_role = 'principal' then 'responsible'
                                else 'auxiliary' end;
  end if;
  return new;
end;
$$;
create trigger members_before_write before insert or update on public.project_members
  for each row execute function public.members_before_write();

-- ---------- Alocação automática de novos projetos (somente se o administrador ativou) ----------
create or replace function public.auto_allocate_new_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members (project_id, user_id, member_role, assigned_by)
  select new.id, p.id, 'auxiliary', auth.uid()
  from public.profiles p
  where p.active and p.can_operate and p.auto_assign_new_projects
  on conflict do nothing;
  return new;
end;
$$;
create trigger zz_auto_allocate after insert on public.projects
  for each row execute function public.auto_allocate_new_project();

-- ---------- Alocação em lote (somente administrador) ----------
create or replace function public.allocate_user_to_projects(
  p_user uuid, p_projects uuid[] default '{}', p_all_active boolean default false, p_auto boolean default null
) returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores gerenciam alocações.' using errcode = '42501';
  end if;

  with alvo as (
    select unnest(coalesce(p_projects, '{}')) as id
    union
    select id from public.projects
    where p_all_active and archived_at is null and status not in ('completed', 'cancelled')
  ), ins as (
    insert into public.project_members (project_id, user_id, member_role)
    select a.id, p_user, 'auxiliary'
    from alvo a join public.projects pr on pr.id = a.id
    on conflict do nothing
    returning 1
  )
  select count(*) into v_n from ins;

  if p_auto is not null then
    update public.profiles set auto_assign_new_projects = p_auto where id = p_user;
  end if;
  return v_n;
end;
$$;
revoke execute on function public.allocate_user_to_projects(uuid, uuid[], boolean, boolean) from public, anon;
grant  execute on function public.allocate_user_to_projects(uuid, uuid[], boolean, boolean) to authenticated;

-- ---------- Consultores não alteram dados administrativos globais do projeto ----------
create or replace function public.guard_project_admin_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
       new.client_id is distinct from old.client_id
    or new.project_type_id is distinct from old.project_type_id
    or new.archived_at is distinct from old.archived_at) then
    raise exception 'Apenas administradores alteram cliente, tipo ou arquivamento do projeto.';
  end if;
  return new;
end;
$$;
create trigger guard_project_admin_fields before update on public.projects
  for each row execute function public.guard_project_admin_fields();

-- ---------- Portal: consultores alocados atualizam o que o cliente vê; links continuam só admin ----------
drop policy if exists public_status_admin on public.project_public_status;
create policy public_status_select on public.project_public_status for select to authenticated
  using (public.can_access_project(project_id));
create policy public_status_insert on public.project_public_status for insert to authenticated
  with check (public.can_access_project(project_id));
create policy public_status_update on public.project_public_status for update to authenticated
  using (public.can_access_project(project_id)) with check (public.can_access_project(project_id));
create policy public_status_delete on public.project_public_status for delete to authenticated
  using (public.is_admin());

-- ---------- Auditoria: comentários e portal também geram histórico ----------
create trigger log_activity after insert or update or delete on public.project_comments
  for each row execute function public.log_activity();
create trigger log_activity after insert or update or delete on public.project_public_status
  for each row execute function public.log_activity();

-- ---------- Credenciais: registrar também as tentativas negadas ----------
do $$
declare c text;
begin
  select conname into c from pg_constraint
  where conrelid = 'public.credential_access_logs'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%action%';
  if c is not null then
    execute format('alter table public.credential_access_logs drop constraint %I', c);
  end if;
end $$;
alter table public.credential_access_logs
  add constraint credential_access_logs_action_check
  check (action in ('create','update','reveal','delete','denied_reveal','denied_save','denied_delete'));
alter table public.credential_access_logs alter column project_id drop not null;
alter table public.credential_access_logs add column if not exists detail text;

-- Negativas NÃO levantam exceção: uma exceção desfaria o próprio registro da tentativa.
drop function if exists public.reveal_credential(uuid);
create function public.reveal_credential(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_project uuid; v_enc bytea;
begin
  select project_id, password_enc into v_project, v_enc from public.project_credentials where id = p_id;
  if v_project is null or not public.can_access_project(v_project) then
    insert into public.credential_access_logs (credential_id, project_id, user_id, action, detail)
    values (p_id, v_project, auth.uid(), 'denied_reveal',
            case when v_project is null then 'credencial inexistente' else 'sem permissão no projeto' end);
    return jsonb_build_object('ok', false, 'error', 'Acesso negado. A tentativa foi registrada.');
  end if;
  insert into public.credential_access_logs (credential_id, project_id, user_id, action)
  values (p_id, v_project, auth.uid(), 'reveal');
  return jsonb_build_object('ok', true,
    'password', case when v_enc is null then null else pgp_sym_decrypt(v_enc, public._credentials_key()) end);
end;
$$;
revoke execute on function public.reveal_credential(uuid) from public, anon;
grant  execute on function public.reveal_credential(uuid) to authenticated;

create or replace function public.save_credential(
  p_project uuid, p_platform text, p_url text, p_login text, p_email text,
  p_password text, p_notes text, p_responsible uuid default null, p_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_key text;
begin
  if not public.can_access_project(p_project) then
    insert into public.credential_access_logs (credential_id, project_id, user_id, action, detail)
    values (p_id, p_project, auth.uid(), 'denied_save', 'sem permissão no projeto');
    return null;
  end if;
  v_key := public._credentials_key();
  if v_key is null then
    raise exception 'Chave de criptografia não configurada.';
  end if;

  if p_id is null then
    insert into public.project_credentials
      (project_id, platform_name, url, login, access_email, password_enc, notes, responsible_id)
    values
      (p_project, p_platform, p_url, p_login, p_email,
       case when p_password is null or p_password = '' then null else pgp_sym_encrypt(p_password, v_key) end,
       p_notes, p_responsible)
    returning id into v_id;
    insert into public.credential_access_logs (credential_id, project_id, user_id, action)
    values (v_id, p_project, auth.uid(), 'create');
  else
    update public.project_credentials c set
      platform_name = p_platform, url = p_url, login = p_login, access_email = p_email,
      notes = p_notes, responsible_id = p_responsible,
      password_enc = case when p_password is null or p_password = '' then c.password_enc
                          else pgp_sym_encrypt(p_password, v_key) end
    where c.id = p_id and c.project_id = p_project
    returning c.id into v_id;
    if v_id is null then
      insert into public.credential_access_logs (credential_id, project_id, user_id, action, detail)
      values (p_id, p_project, auth.uid(), 'denied_save', 'credencial não pertence ao projeto');
      return null;
    end if;
    insert into public.credential_access_logs (credential_id, project_id, user_id, action)
    values (v_id, p_project, auth.uid(), 'update');
  end if;
  return v_id;
end;
$$;

-- Exclusão passa por função para que a negativa também seja registrada
create or replace function public.delete_credential(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_project uuid;
begin
  select project_id into v_project from public.project_credentials where id = p_id;
  if v_project is null or not public.can_access_project(v_project) then
    insert into public.credential_access_logs (credential_id, project_id, user_id, action, detail)
    values (p_id, v_project, auth.uid(), 'denied_delete',
            case when v_project is null then 'credencial inexistente' else 'sem permissão no projeto' end);
    return false;
  end if;
  delete from public.project_credentials where id = p_id;  -- o gatilho registra a exclusão
  return true;
end;
$$;
revoke execute on function public.delete_credential(uuid) from public, anon;
grant  execute on function public.delete_credential(uuid) to authenticated;

drop policy if exists credentials_delete on public.project_credentials;
revoke delete on public.project_credentials from authenticated;
