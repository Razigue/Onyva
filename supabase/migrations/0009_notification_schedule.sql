create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
create function public.configure_notification_schedule(endpoint text, secret text) returns void language plpgsql security definer set search_path='' as $$
declare identifier uuid;
begin
  if $1 !~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/dispatch-notifications$' or length($2)<32 then raise exception 'Invalid notification configuration';end if;
  select id into identifier from vault.secrets where name='onyva_dispatch_url';
  if identifier is null then perform vault.create_secret($1,'onyva_dispatch_url');else perform vault.update_secret(identifier,$1);end if;
  select id into identifier from vault.secrets where name='onyva_dispatch_secret';
  if identifier is null then perform vault.create_secret($2,'onyva_dispatch_secret');else perform vault.update_secret(identifier,$2);end if;
end;
$$;
create function public.dispatch_notification_tick() returns void language plpgsql security definer set search_path='' as $$
declare endpoint text; secret text;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='onyva_dispatch_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name='onyva_dispatch_secret';
  if endpoint is null or secret is null then return;end if;
  perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Authorization','Bearer '||secret,'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=25000);
end;
$$;
revoke execute on function public.configure_notification_schedule(text,text),public.dispatch_notification_tick() from public,anon,authenticated;
grant execute on function public.configure_notification_schedule(text,text),public.dispatch_notification_tick() to service_role;
select cron.schedule('dispatch-onyva-notifications','* * * * *',$$select public.dispatch_notification_tick();$$);
