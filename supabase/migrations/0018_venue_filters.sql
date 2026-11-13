-- Search filters chosen by the organizer: cuisines (dinner only, any of them) and a terrace.
-- They restrict the stations ranked by the engine and the venues proposed, so that the fair search
-- only considers places the group wants. Changing them clears the selected venue and the results.

alter table public.osm_venues add column outdoor_seating boolean;

alter table public.outings
  add column cuisines text[] not null default '{}',
  add column outdoor_seating boolean not null default false,
  add constraint outing_cuisines check (
    cardinality(cuisines) <= 16 and cuisines <@ array['meat','seafood','italian','pizza','chinese','japanese','asian','indian','french','crepe','middleEastern','african','burger','americas','vegetarian','other']
  );

-- Cuisines apply only to restaurants: bars and cafés seldom document one.
create function public.venue_matches_filter(venue_cuisines jsonb, venue_outdoor boolean, activity_kind text, cuisines text[], outdoor boolean)
returns boolean language sql immutable set search_path='' as $$
  select (coalesce(cardinality($4), 0) = 0 or $3 <> 'dinner' or $1 ?| $4) and (not coalesce($5, false) or $2 is true);
$$;

drop function public.venue_station_ids(text,double precision,double precision);
create function public.venue_station_ids(activity_kind text, starts_at_epoch double precision, ends_at_epoch double precision, cuisines text[] default '{}', outdoor boolean default false) returns text[] language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(distinct s.id), '{}')
  from public.osm_venues v
  join public.venue_imports i on i.current_import=v.import_id
  join public.stations s on s.active and extensions.st_dwithin(s.position,v.position,240)
  where i.imported_at>now()-interval '8 days' and v.kind=$1
    and public.venue_matches_filter(v.cuisines, v.outdoor_seating, $1, $4, $5)
    and exists(select 1 from jsonb_array_elements(v.open_intervals) hours where (hours->>'start')::double precision<=$2 and (hours->>'end')::double precision>=$3);
$$;
revoke execute on function public.venue_station_ids(text,double precision,double precision,text[],boolean) from public,anon,authenticated;
grant execute on function public.venue_station_ids(text,double precision,double precision,text[],boolean) to service_role;

drop function public.nearby_venues(text[],text,double precision,double precision,integer);
create function public.nearby_venues(station_ids text[], activity_kind text, starts_at_epoch double precision, ends_at_epoch double precision, station_count integer default 1, cuisines text[] default '{}', outdoor boolean default false) returns jsonb language sql stable security definer set search_path='' as $$
  with chosen_station as (
    select s.* from unnest($1[1:20000]) with ordinality ranked(id,position)
    join public.stations s on s.id=ranked.id and s.active
    where exists(
      select 1 from public.osm_venues v join public.venue_imports i on i.current_import=v.import_id
      where i.imported_at>now()-interval '8 days' and v.kind=$2 and extensions.st_dwithin(s.position,v.position,240)
        and public.venue_matches_filter(v.cuisines, v.outdoor_seating, $2, $6, $7)
        and exists(select 1 from jsonb_array_elements(v.open_intervals) hours where (hours->>'start')::double precision<=$3 and (hours->>'end')::double precision>=$4)
    ) order by ranked.position limit greatest(1, least(coalesce($5, 1), 3))
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'kind',v.kind,'stationId',s.id,'neighborhood',s.name,
    'longitude',v.longitude,'latitude',v.latitude,'cuisines',v.cuisines,'outdoorSeating',v.outdoor_seating,'openIntervals',v.open_intervals,'source','osm',
    'walkSeconds',ceil(extensions.st_distance(s.position,v.position)*1.5/1.2)::integer)),'[]'::jsonb)
  from chosen_station s cross join lateral (
    select v.* from public.osm_venues v join public.venue_imports i on i.current_import=v.import_id
    where v.kind=$2 and extensions.st_dwithin(s.position,v.position,240)
      and public.venue_matches_filter(v.cuisines, v.outdoor_seating, $2, $6, $7)
      and exists(select 1 from jsonb_array_elements(v.open_intervals) hours where (hours->>'start')::double precision<=$3 and (hours->>'end')::double precision>=$4)
    order by extensions.st_distance(s.position,v.position),v.id limit 30
  ) v;
$$;
revoke execute on function public.nearby_venues(text[],text,double precision,double precision,integer,text[],boolean) from public,anon,authenticated;
grant execute on function public.nearby_venues(text[],text,double precision,double precision,integer,text[],boolean) to service_role;

-- Manual listing and selection follow the same filters.
create or replace function public.list_outing_venues(target uuid, station_id text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare outing public.outings;
begin
  if not public.is_member($1) then raise exception 'Not a member'; end if;
  select * into outing from public.outings where id=$1;
  if outing.starts_at<=now() then raise exception 'Outing already started'; end if;
  return public.nearby_venues(array[$2],outing.activity,extract(epoch from outing.starts_at),extract(epoch from outing.ends_at),1,outing.cuisines,outing.outdoor_seating);
end;
$$;
create or replace function public.select_outing_venue(target uuid, station_id text, venue_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare outing public.outings; candidate jsonb;
begin
  select * into outing from public.outings where id=$1 for update;
  if not found or outing.owner_id is distinct from auth.uid() or outing.confirmed_venue_id is not null or outing.starts_at<=now() then raise exception 'Cannot edit outing'; end if;
  select item into candidate from jsonb_array_elements(public.nearby_venues(array[$2],outing.activity,extract(epoch from outing.starts_at),extract(epoch from outing.ends_at),1,outing.cuisines,outing.outdoor_seating)) item where item->>'id'=$3;
  if candidate is null then raise exception 'Venue unavailable'; end if;
  update public.outings set selected_venue=candidate,recommendations=null,updated_at=date_trunc('milliseconds',clock_timestamp()) where id=$1;
  return public.get_outing($1);
end;
$$;

create or replace function public.get_outing(outing_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_member($1) then raise exception 'Not a member'; end if;
  select jsonb_build_object('id', o.id, 'ownerId', o.owner_id, 'inviteCode', o.invite_code, 'shortCode', o.short_code,
    'startsAt', to_char(o.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'endsAt', to_char(o.ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt', to_char(o.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'selectedVenue', o.selected_venue, 'activity', o.activity, 'confirmedVenueId', o.confirmed_venue_id, 'mode', 'live',
    'filters', jsonb_build_object('cuisines', to_jsonb(o.cuisines), 'outdoorSeating', o.outdoor_seating),
    'participants', (select jsonb_agg(jsonb_build_object('id', p.id, 'userId', p.user_id, 'name', p.name, 'departureId', p.departure_id, 'returnId', p.return_id) order by p.joined_at, p.id) from public.participants p where p.outing_id = o.id)) into result
  from public.outings o where o.id = $1;
  return result;
end;
$$;

create or replace function public.create_outing(payload jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare outing_id uuid; chosen text[];
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if (payload->>'startsAt')::timestamptz <= now() or (payload->>'startsAt')::timestamptz > now() + interval '7 days' then raise exception 'Date outside planning window'; end if;
  if (select count(*) from public.outings where owner_id = auth.uid()) >= 20 then raise exception 'Outing limit reached'; end if;
  select coalesce(array_agg(distinct value), '{}') into chosen from jsonb_array_elements_text(coalesce(payload->'filters'->'cuisines', '[]'));
  insert into public.outings(owner_id, starts_at, ends_at, activity, cuisines, outdoor_seating)
    values(auth.uid(), (payload->>'startsAt')::timestamptz, (payload->>'endsAt')::timestamptz, payload->>'activity', chosen, coalesce((payload->'filters'->>'outdoorSeating')::boolean, false))
    returning id into outing_id;
  insert into public.participants(outing_id, user_id, name, departure_id, return_id) values(outing_id, auth.uid(), trim(payload->>'name'), payload->>'departureId', payload->>'departureId');
  return public.get_outing(outing_id);
end;
$$;

-- Organizer only, before the start and before confirmation. A new revision restarts the search.
create function public.set_outing_filters(target uuid, cuisines text[], outdoor_seating boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare outing public.outings; chosen text[];
begin
  select * into outing from public.outings where id=$1 for update;
  if not found or outing.owner_id is distinct from auth.uid() or outing.confirmed_venue_id is not null or outing.starts_at<=now() then raise exception 'Cannot edit outing'; end if;
  select coalesce(array_agg(distinct value order by value), '{}') into chosen from unnest(coalesce($2, '{}')) value;
  if chosen = (select coalesce(array_agg(value order by value), '{}') from unnest(outing.cuisines) value) and outing.outdoor_seating = coalesce($3, false) then return public.get_outing($1); end if;
  update public.outings set cuisines=chosen, outdoor_seating=coalesce($3, false), selected_venue=null, recommendations=null,
    updated_at=date_trunc('milliseconds',clock_timestamp()) where id=$1;
  return public.get_outing($1);
end;
$$;
revoke execute on function public.set_outing_filters(uuid,text[],boolean) from public,anon,authenticated;
grant execute on function public.set_outing_filters(uuid,text[],boolean) to authenticated;
