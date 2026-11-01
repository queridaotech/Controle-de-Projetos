-- 0007: endurecimento de funções (aplicado no projeto real após o advisor de segurança)

-- Funções internas e de trigger: ninguém chama via API (triggers continuam funcionando)
revoke execute on function public.notify_user(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_members(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.recalc_project_progress(uuid) from public, anon, authenticated;
revoke execute on function public.trg_recalc_progress() from public, anon, authenticated;
revoke execute on function public.trg_notify() from public, anon, authenticated;
revoke execute on function public.log_activity() from public, anon, authenticated;
revoke execute on function public.log_credential_delete() from public, anon, authenticated;
revoke execute on function public.init_project() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;

-- Helpers usados pelas políticas RLS: só usuários logados
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_project_member(uuid) from public, anon;
revoke execute on function public.can_access_project(uuid) from public, anon;
grant  execute on function public.is_admin() to authenticated;
grant  execute on function public.is_project_member(uuid) to authenticated;
grant  execute on function public.can_access_project(uuid) to authenticated;

-- search_path fixo nas funções que ainda não tinham
alter function public.projects_before_write() set search_path = '';
alter function public.set_updated_at() set search_path = '';
alter function public.stamp_completion() set search_path = '';
alter function public.public_status_label(text) set search_path = '';
alter function public.path_project_id(text) set search_path = '';
