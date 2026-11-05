-- Plafond quotidien d’appels PRIM par personne, en plus du plafond partagé.
-- Les sessions anonymes rendent la création de comptes facile : une seule personne ne doit pas épuiser le quota de tous.
create table public.prim_user_usage (
  usage_day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  calls integer not null default 0 check (calls >= 0),
  primary key (usage_day, user_id)
);
alter table public.prim_user_usage enable row level security;
revoke all on public.prim_user_usage from public, anon, authenticated;
grant all on public.prim_user_usage to service_role;

create function public.reserve_prim_user_call(requester uuid, daily_limit integer, user_limit integer) returns boolean language plpgsql security definer set search_path = '' as $$
declare used integer; today date := (now() at time zone 'Europe/Paris')::date;
begin
  if $1 is null or $3 < 1 or $3 > $2 then return false; end if;
  insert into public.prim_user_usage values(today,$1,0) on conflict do nothing;
  update public.prim_user_usage set calls=calls+1 where usage_day=today and user_id=$1 and calls<$3 returning calls into used;
  if used is null then return false; end if;
  if not public.reserve_prim_call('general',$2) then
    -- Le quota partagé est épuisé : l’appel n’a pas lieu, il ne compte donc pas pour la personne.
    update public.prim_user_usage set calls=calls-1 where usage_day=today and user_id=$1;
    return false;
  end if;
  return true;
end;
$$;
revoke execute on function public.reserve_prim_user_call(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_prim_user_call(uuid,integer,integer) to service_role;

select cron.schedule('expire-prim-user-usage','17 3 * * *',$$delete from public.prim_user_usage where usage_day<(now() at time zone 'Europe/Paris')::date-2;$$);
