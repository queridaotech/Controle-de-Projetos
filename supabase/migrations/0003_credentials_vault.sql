-- =====================================================================
-- 0003: cofre de credenciais
-- - Senhas cifradas em repouso (pgcrypto) com chave guardada no Supabase Vault.
-- - A chave NUNCA sai do banco e não existe no frontend.
-- - Escrita e leitura de senha apenas via funções, com auditoria.
-- =====================================================================

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'credentials_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'credentials_key',
      'Chave de criptografia do cofre de credenciais'
    );
  end if;
end $$;

create or replace function public._credentials_key()
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'credentials_key' limit 1;
$$;
revoke execute on function public._credentials_key() from public, anon, authenticated;

-- Cria ou atualiza uma credencial. p_password nulo em atualização mantém a senha atual.
create or replace function public.save_credential(
  p_project uuid, p_platform text, p_url text, p_login text, p_email text,
  p_password text, p_notes text, p_responsible uuid default null, p_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_key text;
begin
  if not public.can_access_project(p_project) then
    raise exception 'Sem permissão para este projeto.' using errcode = '42501';
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
       case when p_password is null or p_password = '' then null
            else pgp_sym_encrypt(p_password, v_key) end,
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
      raise exception 'Credencial não encontrada.';
    end if;
    insert into public.credential_access_logs (credential_id, project_id, user_id, action)
    values (v_id, p_project, auth.uid(), 'update');
  end if;
  return v_id;
end;
$$;

-- Revela a senha (a interface deve pedir confirmação antes). Todo acesso é auditado.
create or replace function public.reveal_credential(p_id uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_project uuid; v_enc bytea;
begin
  select project_id, password_enc into v_project, v_enc from public.project_credentials where id = p_id;
  if v_project is null or not public.can_access_project(v_project) then
    raise exception 'Credencial não encontrada ou sem permissão.' using errcode = '42501';
  end if;
  insert into public.credential_access_logs (credential_id, project_id, user_id, action)
  values (p_id, v_project, auth.uid(), 'reveal');
  if v_enc is null then return null; end if;
  return pgp_sym_decrypt(v_enc, public._credentials_key());
end;
$$;

create or replace function public.log_credential_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.credential_access_logs (credential_id, project_id, user_id, action)
  values (old.id, old.project_id, auth.uid(), 'delete');
  return old;
end;
$$;
create trigger log_credential_delete after delete on public.project_credentials
  for each row execute function public.log_credential_delete();

revoke execute on function public.save_credential(uuid,text,text,text,text,text,text,uuid,uuid) from public, anon;
revoke execute on function public.reveal_credential(uuid) from public, anon;
grant  execute on function public.save_credential(uuid,text,text,text,text,text,text,uuid,uuid) to authenticated;
grant  execute on function public.reveal_credential(uuid) to authenticated;
