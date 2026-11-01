-- permite relacionar o log de acesso ao usuário (mantém o log mesmo se o usuário for removido)
alter table public.credential_access_logs
  add constraint credential_access_logs_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;
