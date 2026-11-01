-- 0012: alerta aos administradores quando há tentativa negada de acesso a credenciais
-- (no máximo 1 alerta por pessoa e por administrador a cada 10 minutos, para não gerar enxurrada)
create or replace function public.alert_denied_credential()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_body text; v_proj text;
begin
  if new.action not like 'denied%' then return new; end if;
  select coalesce(nullif(full_name, ''), email) into v_name from public.profiles where id = new.user_id;
  select name into v_proj from public.projects where id = new.project_id;
  v_body := coalesce(v_name, 'Usuário desconhecido') || case when v_proj is null then '' else ' · ' || v_proj end;

  insert into public.notifications (user_id, project_id, type, title, body)
  select a.id, new.project_id, 'security_alert', 'Tentativa negada de acesso a credencial', v_body
  from public.profiles a
  where a.role = 'admin' and a.active and a.id is distinct from new.user_id
    and not exists (
      select 1 from public.notifications n
      where n.user_id = a.id and n.type = 'security_alert' and n.body = v_body
        and n.created_at > now() - interval '10 minutes');
  return new;
end;
$$;
revoke execute on function public.alert_denied_credential() from public, anon, authenticated;

create trigger alert_denied after insert on public.credential_access_logs
  for each row execute function public.alert_denied_credential();
