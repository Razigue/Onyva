create function public.new_short_invite_code() returns text language plpgsql volatile set search_path = '' as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; result text := ''; bytes bytea := extensions.gen_random_bytes(8);
begin
  for i in 0..7 loop result := result || substr(alphabet,1+get_byte(bytes,i)%length(alphabet),1); end loop;
  return result;
end;
$$;
alter table public.outings add column short_code text not null default public.new_short_invite_code();
create unique index outings_short_code_unique on public.outings(short_code);
alter table public.outings add constraint valid_short_code check(short_code ~ '^[A-HJ-NP-Z2-9]{8}$');
create table public.invite_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade, window_at timestamptz not null, attempts integer not null
);
alter table public.invite_attempts enable row level security;
revoke all on public.invite_attempts from public,anon,authenticated;
grant all on public.invite_attempts to service_role;
create function public.resolve_invite_code(short_code text) returns uuid language plpgsql security definer set search_path = '' as $$
declare attempts integer; result uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  insert into public.invite_attempts values(auth.uid(),now(),1) on conflict(user_id) do update set
    attempts=case when public.invite_attempts.window_at<now()-interval '1 minute' then 1 else public.invite_attempts.attempts+1 end,
    window_at=case when public.invite_attempts.window_at<now()-interval '1 minute' then now() else public.invite_attempts.window_at end
    returning public.invite_attempts.attempts into attempts;
  if attempts>20 then return null; end if;
  select invite_code into result from public.outings where public.outings.short_code=upper(trim($1)) and starts_at>now();
  return result;
end;
$$;
create or replace function public.preview_invitation(invite_code uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name',(select p.name from public.participants p where p.outing_id=o.id and p.user_id=o.owner_id),
    'startsAt',to_char(o.starts_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'activity',o.activity,'shortCode',o.short_code,
    'count',(select count(*) from public.participants p where p.outing_id=o.id)) from public.outings o where o.invite_code=$1 and o.starts_at>now();
$$;
revoke execute on function public.new_short_invite_code(),public.resolve_invite_code(text) from public,anon,authenticated;
grant execute on function public.resolve_invite_code(text) to authenticated;
