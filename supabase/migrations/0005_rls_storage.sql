-- =====================================================================
-- 0005: Row Level Security, privilégios e Storage
-- Regra geral: administrador vê tudo; consultor só os projetos em que está
-- alocado (project_members); anônimo não acessa nenhuma tabela.
-- =====================================================================

-- Anônimo: nenhum acesso direto às tabelas (o portal usa get_public_project)
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

do $$
declare t text;
begin
  for t in select table_name from information_schema.tables
           where table_schema = 'public' and table_type = 'BASE TABLE'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- Tabelas de referência (leitura geral, escrita só admin) ----------
do $$
declare t text;
begin
  foreach t in array array['roles','project_types','stage_templates','stage_template_tasks',
                           'document_checklists','supply_families'] loop
    execute format('create policy "%1$s_select" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "%1$s_admin_write" on public.%1$I for all to authenticated
                    using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------- profiles ----------
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated using (public.is_admin());
-- INSERT em profiles ocorre apenas pelo trigger de cadastro (security definer)

-- ---------- clients ----------
create policy clients_select on public.clients for select to authenticated using (
  public.is_admin()
  or exists (select 1 from public.projects p where p.client_id = clients.id and public.is_project_member(p.id))
);
create policy clients_admin_write on public.clients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- projects ----------
create policy projects_select on public.projects for select to authenticated using (public.can_access_project(id));
create policy projects_insert on public.projects for insert to authenticated with check (public.is_admin());
create policy projects_update on public.projects for update to authenticated
  using (public.can_access_project(id)) with check (public.can_access_project(id));
create policy projects_delete on public.projects for delete to authenticated using (public.is_admin());

-- ---------- project_members (somente admin aloca) ----------
create policy members_select on public.project_members for select to authenticated using (public.can_access_project(project_id));
create policy members_admin_write on public.project_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- tabelas filhas: acesso por projeto ----------
do $$
declare t text;
begin
  foreach t in array array['project_stages','project_tasks','milestones','project_documents',
                           'project_criteria','project_certifications','project_pending_items',
                           'project_supply_families'] loop
    execute format('create policy "%1$s_select" on public.%1$I for select to authenticated using (public.can_access_project(project_id))', t);
    execute format('create policy "%1$s_insert" on public.%1$I for insert to authenticated with check (public.can_access_project(project_id))', t);
    execute format('create policy "%1$s_update" on public.%1$I for update to authenticated
                    using (public.can_access_project(project_id)) with check (public.can_access_project(project_id))', t);
    if t <> 'project_stages' then   -- etapas só podem ser removidas por admin
      execute format('create policy "%1$s_delete" on public.%1$I for delete to authenticated using (public.can_access_project(project_id))', t);
    end if;
  end loop;
end $$;
create policy project_stages_delete on public.project_stages for delete to authenticated using (public.is_admin());

-- ---------- comentários (internos): editar/excluir só o autor ou admin ----------
create policy comments_select on public.project_comments for select to authenticated using (public.can_access_project(project_id));
create policy comments_insert on public.project_comments for insert to authenticated
  with check (public.can_access_project(project_id) and author_id = auth.uid());
create policy comments_update on public.project_comments for update to authenticated
  using (author_id = auth.uid() or public.is_admin()) with check (author_id = auth.uid() or public.is_admin());
create policy comments_delete on public.project_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- ---------- histórico: somente leitura (gravado por triggers) ----------
create policy activity_select on public.project_activity_logs for select to authenticated using (public.can_access_project(project_id));

-- ---------- credenciais ----------
create policy credentials_select on public.project_credentials for select to authenticated using (public.can_access_project(project_id));
create policy credentials_delete on public.project_credentials for delete to authenticated using (public.can_access_project(project_id));
-- Sem políticas de INSERT/UPDATE: escrita somente por save_credential()
revoke insert, update on public.project_credentials from authenticated;
-- A coluna password_enc não é legível pelo cliente; selecione colunas explicitamente
revoke select on public.project_credentials from authenticated;
grant select (id, project_id, platform_name, url, login, access_email, notes, responsible_id,
              created_by, created_at, updated_at) on public.project_credentials to authenticated;

create policy cred_logs_select on public.credential_access_logs for select to authenticated using (public.is_admin());

-- ---------- portal: gestão apenas por admin ----------
create policy public_links_admin on public.project_public_links for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy public_status_admin on public.project_public_status for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- notificações: cada usuário vê e marca as suas ----------
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- =====================================================================
-- Storage: bucket privado para documentos. Caminho: {project_id}/{arquivo}
-- =====================================================================
create or replace function public.path_project_id(p_path text)
returns uuid language sql immutable as $$
  select case when split_part(p_path, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_path, '/', 1)::uuid end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (
  'project-documents', 'project-documents', false, 26214400,
  array['application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/csv', 'image/png', 'image/jpeg', 'application/zip']
) on conflict (id) do nothing;

create policy "project docs read" on storage.objects for select to authenticated
  using (bucket_id = 'project-documents' and public.can_access_project(public.path_project_id(name)));
create policy "project docs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-documents' and public.can_access_project(public.path_project_id(name)));
create policy "project docs update" on storage.objects for update to authenticated
  using (bucket_id = 'project-documents' and public.can_access_project(public.path_project_id(name)));
create policy "project docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-documents' and public.can_access_project(public.path_project_id(name)));
