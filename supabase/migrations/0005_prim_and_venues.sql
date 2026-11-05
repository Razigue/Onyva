create extension if not exists postgis with schema extensions;
alter table public.stations add column active boolean not null default false;
alter table public.stations add column position extensions.geography(point,4326)
  generated always as (extensions.st_setsrid(extensions.st_makepoint(longitude, latitude),4326)::extensions.geography) stored;
create index stations_position_idx on public.stations using gist(position);

create table public.venue_imports (
  singleton boolean primary key default true check (singleton), current_import uuid, imported_at timestamptz
);
insert into public.venue_imports(singleton) values(true);
create table public.osm_venues (
  import_id uuid not null, id text not null, name text not null, kind text not null check(kind in ('drinks','dinner','coffee')),
  longitude double precision not null check(longitude between 1.4 and 3.6), latitude double precision not null check(latitude between 48.1 and 49.3),
  opening_hours text, cuisines jsonb not null default '[]', open_intervals jsonb not null default '[]',
  position extensions.geography(point,4326) generated always as (extensions.st_setsrid(extensions.st_makepoint(longitude, latitude),4326)::extensions.geography) stored,
  primary key(import_id, id)
);
create index osm_venues_position_idx on public.osm_venues using gist(position);
alter table public.venue_imports enable row level security;
alter table public.osm_venues enable row level security;
revoke all on public.venue_imports, public.osm_venues from public, anon, authenticated;
grant all on public.venue_imports, public.osm_venues to service_role;

create function public.activate_venue_import(batch_id uuid, expected_count integer) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('onyva-venue-import'));
  if $2 < 1 or (select count(*) from public.osm_venues where import_id = $1) <> $2 then raise exception 'Incomplete venue import'; end if;
  update public.venue_imports set current_import = $1, imported_at = now() where singleton;
  delete from public.osm_venues where import_id <> $1;
end;
$$;
create function public.nearby_venues(station_ids text[], activity_kind text) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'kind',v.kind,'stationId',s.id,'neighborhood',s.name,
    'longitude',v.longitude,'latitude',v.latitude,'cuisines',v.cuisines,'openIntervals',v.open_intervals,'source','osm',
    'walkSeconds',ceil(extensions.st_distance(s.position,v.position)*1.5/1.2)::integer)), '[]'::jsonb)
  from public.stations s cross join lateral (
    select v.* from public.osm_venues v join public.venue_imports i on i.current_import = v.import_id
    where i.imported_at > now() - interval '8 days' and v.kind = $2 and extensions.st_dwithin(s.position,v.position,240)
    order by extensions.st_distance(s.position,v.position),v.id limit 30
  ) v where s.id = any($1[1:20]) and s.active;
$$;

create table public.prim_cache (
  outing_id uuid not null references public.outings(id) on delete cascade, cache_key text not null,
  state text not null check(state in ('pending','ready')), payload jsonb, expires_at timestamptz not null,
  primary key(outing_id,cache_key)
);
create index prim_cache_expiry_idx on public.prim_cache(expires_at);
create table public.prim_calculations (
  outing_id uuid primary key references public.outings(id) on delete cascade,
  revision timestamptz not null, claim_id uuid not null, expires_at timestamptz not null
);
create table public.prim_usage (
  usage_day date not null, api text not null, calls integer not null default 0 check(calls>=0), primary key(usage_day,api)
);
alter table public.prim_cache enable row level security;
alter table public.prim_calculations enable row level security;
alter table public.prim_usage enable row level security;
revoke all on public.prim_cache, public.prim_calculations, public.prim_usage from public, anon, authenticated;
grant all on public.prim_cache, public.prim_calculations, public.prim_usage to service_role;

create function public.reserve_prim_call(api_name text, daily_limit integer) returns boolean language plpgsql security definer set search_path = '' as $$
declare used integer; today date := (now() at time zone 'Europe/Paris')::date;
begin
  if $2 < 1 or $2 > 1000000 or $1 <> 'general' then return false; end if;
  insert into public.prim_usage values(today,$1,0) on conflict do nothing;
  update public.prim_usage set calls = calls + 1 where usage_day = today and api = $1 and calls < $2 returning calls into used;
  return used is not null;
end;
$$;
create function public.claim_prim_cache(target uuid, key text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare cached public.prim_cache;
begin
  perform pg_advisory_xact_lock(hashtext($1::text || $2));
  select * into cached from public.prim_cache where outing_id=$1 and cache_key=$2;
  if found and cached.expires_at > now() then
    return jsonb_build_object('state',cached.state,'payload',cached.payload);
  end if;
  insert into public.prim_cache values($1,$2,'pending',null,now()+interval '15 seconds')
    on conflict(outing_id,cache_key) do update set state='pending',payload=null,expires_at=excluded.expires_at;
  return jsonb_build_object('state','claimed');
end;
$$;
create function public.claim_prim_calculation(target uuid, expected_revision timestamptz, token uuid) returns boolean language plpgsql security definer set search_path = '' as $$
declare current_job public.prim_calculations;
begin
  perform 1 from public.outings where id=$1 and updated_at=$2 and confirmed_venue_id is null for update;
  if not found then return false; end if;
  select * into current_job from public.prim_calculations where outing_id=$1;
  if found and current_job.revision=$2 and current_job.expires_at>now() then return false; end if;
  insert into public.prim_calculations values($1,$2,$3,now()+interval '90 seconds')
    on conflict(outing_id) do update set revision=$2,claim_id=$3,expires_at=excluded.expires_at;
  return true;
end;
$$;
create function public.save_prim_progress(target uuid, expected_revision timestamptz, token uuid, result jsonb) returns boolean language plpgsql security definer set search_path = '' as $$
declare saved uuid;
begin
  update public.outings o set recommendations=$4 where o.id=$1 and o.updated_at=$2 and o.confirmed_venue_id is null
    and exists(select 1 from public.prim_calculations j where j.outing_id=$1 and j.claim_id=$3 and j.revision=$2)
    returning o.id into saved;
  if $4->'progress'->>'stage' in ('complete','failed') then
    delete from public.prim_calculations where outing_id=$1 and claim_id=$3;
  end if;
  return saved is not null;
end;
$$;
-- Existing GTFS recommendations cannot be used after the provider migration.
update public.outings set recommendations=null where confirmed_venue_id is null;

create or replace function public.confirm_venue(outing_id uuid, venue_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare outing public.outings;
begin
  select * into outing from public.outings where id=$1 for update;
  if not found or outing.owner_id is distinct from auth.uid() or outing.starts_at<=now() then raise exception 'Cannot confirm outing'; end if;
  if outing.confirmed_venue_id is not null then raise exception 'Already confirmed'; end if;
  if outing.recommendations is null or (outing.recommendations->>'computedAt')::timestamptz<now()-interval '15 minutes' then raise exception 'Refresh recommendations'; end if;
  if outing.recommendations->>'source'<>'prim' or coalesce(outing.recommendations->'progress'->>'stage','')<>'complete' then raise exception 'Return verification incomplete'; end if;
  if not exists(select 1 from jsonb_array_elements(outing.recommendations->'recommendations') r where r->'venue'->>'id'=$2 and jsonb_array_length(r->'journeys')=(select count(*) from public.participants where public.participants.outing_id=$1)) then raise exception 'Unknown venue'; end if;
  update public.outings set confirmed_venue_id=$2,updated_at=date_trunc('milliseconds',clock_timestamp()) where id=$1;
  return public.get_outing($1);
end;
$$;
revoke execute on function public.activate_venue_import(uuid,integer), public.nearby_venues(text[],text), public.reserve_prim_call(text,integer), public.claim_prim_cache(uuid,text), public.claim_prim_calculation(uuid,timestamptz,uuid), public.save_prim_progress(uuid,timestamptz,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.activate_venue_import(uuid,integer), public.nearby_venues(text[],text), public.reserve_prim_call(text,integer), public.claim_prim_cache(uuid,text), public.claim_prim_calculation(uuid,timestamptz,uuid), public.save_prim_progress(uuid,timestamptz,uuid,jsonb) to service_role;
select cron.schedule('expire-prim-cache','* * * * *',$$delete from public.prim_cache where expires_at<=now(); delete from public.prim_calculations where expires_at<=now(); delete from public.prim_usage where usage_day<(now() at time zone 'Europe/Paris')::date-2;$$);
