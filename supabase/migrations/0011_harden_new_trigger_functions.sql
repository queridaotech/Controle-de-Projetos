-- 0011: funções de gatilho da 0010 não devem ser chamáveis via API
revoke execute on function public.auto_allocate_new_project() from public, anon, authenticated;
revoke execute on function public.guard_project_admin_fields() from public, anon, authenticated;
revoke execute on function public.members_before_write() from public, anon, authenticated;
