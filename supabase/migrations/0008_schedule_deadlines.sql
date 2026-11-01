-- 0008: agenda diária dos alertas de prazo (08:00 em Brasília = 11:00 UTC)
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'petrosupply-deadline-notifications') then
    perform cron.unschedule('petrosupply-deadline-notifications');
  end if;
  perform cron.schedule(
    'petrosupply-deadline-notifications',
    '0 11 * * *',
    $job$select public.generate_deadline_notifications();$job$
  );
end $$;
