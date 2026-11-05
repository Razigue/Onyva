alter table public.venue_reactions enable row level security;
alter table public.outing_push_subscriptions enable row level security;
alter table public.outing_push_subscriptions add constraint push_state check (state in ('idle','pending','sending','ticket','sent','failed'));
alter table public.outing_push_subscriptions add constraint push_attempts check (attempts between 0 and 3);
alter table public.outing_push_subscriptions add constraint push_token check (length(token) <= 200 and token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$');
create index push_pending_idx on public.outing_push_subscriptions(state, available_at);
revoke all on public.venue_reactions, public.outing_push_subscriptions from anon, authenticated;
grant select on public.venue_reactions, public.outing_push_subscriptions to authenticated;
grant all on public.venue_reactions, public.outing_push_subscriptions to service_role;
create policy reactions_members on public.venue_reactions for select to authenticated using (public.is_member(outing_id));
create policy push_own on public.outing_push_subscriptions for select to authenticated using (user_id = auth.uid() and public.is_member(outing_id));

create function public.get_venue_reactions(outing_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_member($1) then raise exception 'Not a member'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('venueId', r.venue_id, 'userId', r.user_id) order by r.venue_id, r.user_id), '[]'::jsonb) from public.venue_reactions r where r.outing_id = $1);
end;
$$;
create function public.set_venue_reaction(outing_id uuid, venue_id text, liked boolean) returns jsonb language plpgsql security definer set search_path = '' as $$
declare outing public.outings;
begin
  select * into outing from public.outings where id = $1 for update;
  if not public.is_member($1) then raise exception 'Not a member'; end if;
  if outing.confirmed_venue_id is not null or outing.starts_at <= now() then raise exception 'Voting closed'; end if;
  if $3 is null or not exists(select 1 from jsonb_array_elements(outing.recommendations->'recommendations') r where r->'venue'->>'id' = $2) then raise exception 'Unknown venue'; end if;
  if $3 then
    insert into public.venue_reactions values ($1, auth.uid(), $2) on conflict do nothing;
  else
    delete from public.venue_reactions r where r.outing_id = $1 and r.user_id = auth.uid() and r.venue_id = $2;
  end if;
  return public.get_venue_reactions($1);
end;
$$;

create function public.register_outing_push(outing_id uuid, push_token text) returns void language plpgsql security definer set search_path = '' as $$
declare outing public.outings;
begin
  select * into outing from public.outings where id = $1 for update;
  if not public.is_member($1) then raise exception 'Not a member'; end if;
  if outing.confirmed_venue_id is not null or outing.starts_at <= now() then raise exception 'Already confirmed or started'; end if;
  if exists(select 1 from public.outing_push_subscriptions s where s.outing_id = $1 and s.token = $2 and s.user_id = auth.uid()) then return; end if;
  if (select count(*) from public.outing_push_subscriptions s where s.outing_id = $1 and s.user_id = auth.uid()) >= 3 then raise exception 'Device limit reached'; end if;
  insert into public.outing_push_subscriptions(outing_id, user_id, token) values ($1, auth.uid(), $2);
end;
$$;
create function public.unregister_push_token(push_token text) returns void language sql security definer set search_path = '' as $$
  delete from public.outing_push_subscriptions where user_id = auth.uid() and token = $1;
$$;

create function public.outing_interactions_changed() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.recommendations is distinct from old.recommendations then
    delete from public.venue_reactions r where r.outing_id = new.id and not exists(select 1 from jsonb_array_elements(new.recommendations->'recommendations') c where c->'venue'->>'id' = r.venue_id);
  end if;
  if old.confirmed_venue_id is null and new.confirmed_venue_id is not null then
    update public.outing_push_subscriptions set state = 'pending', available_at = now() where outing_id = new.id and state = 'idle';
  end if;
  return new;
end;
$$;
create trigger outing_interactions_changed after update on public.outings for each row execute function public.outing_interactions_changed();

-- A lease prevents concurrent dispatchers from sending the same queued job.
create function public.claim_push_jobs() returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  update public.outing_push_subscriptions set state = 'failed' where state in ('pending','sending') and attempts >= 3 and available_at <= now();
  with candidates as (
    select s.id from public.outing_push_subscriptions s join public.outings o on o.id = s.outing_id
    where s.state in ('pending','sending') and s.attempts < 3 and s.available_at <= now() and o.starts_at > now() and o.confirmed_venue_id is not null
    order by s.available_at limit 50 for update of s skip locked
  ), claimed as (
    update public.outing_push_subscriptions s set state = 'sending', attempts = attempts + 1, available_at = now() + interval '5 minutes'
    from candidates c where s.id = c.id returning s.*
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'token', c.token, 'outingId', c.outing_id, 'attempts', c.attempts,
    'venueName', v->'venue'->>'name', 'startsAt', to_char(o.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))), '[]'::jsonb) into result
  from claimed c join public.outings o on o.id = c.outing_id
  cross join lateral jsonb_array_elements(o.recommendations->'recommendations') v where v->'venue'->>'id' = o.confirmed_venue_id;
  return result;
end;
$$;
revoke execute on function public.get_venue_reactions(uuid), public.set_venue_reaction(uuid,text,boolean), public.register_outing_push(uuid,text), public.unregister_push_token(text), public.outing_interactions_changed(), public.claim_push_jobs() from public, anon, authenticated;
grant execute on function public.get_venue_reactions(uuid), public.set_venue_reaction(uuid,text,boolean), public.register_outing_push(uuid,text), public.unregister_push_token(text) to authenticated;
grant execute on function public.claim_push_jobs() to service_role;
