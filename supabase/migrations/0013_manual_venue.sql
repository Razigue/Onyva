alter table public.outings add column selected_venue jsonb;
create or replace function public.get_outing(outing_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_member($1) then raise exception 'Not a member'; end if;
  select jsonb_build_object('id', o.id, 'ownerId', o.owner_id, 'inviteCode', o.invite_code,
    'startsAt', to_char(o.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'endsAt', to_char(o.ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt', to_char(o.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'selectedVenue', o.selected_venue, 'activity', o.activity, 'confirmedVenueId', o.confirmed_venue_id, 'mode', 'live',
    'participants', (select jsonb_agg(jsonb_build_object('id', p.id, 'userId', p.user_id, 'name', p.name, 'departureId', p.departure_id, 'returnId', p.return_id) order by p.joined_at, p.id) from public.participants p where p.outing_id = o.id)) into result
  from public.outings o where o.id = $1;
  return result;
end;
$$;


create function public.list_outing_venues(target uuid, station_id text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare outing public.outings;
begin
  if not public.is_member($1) then raise exception 'Not a member'; end if;
  select * into outing from public.outings where id=$1;
  if outing.starts_at<=now() then raise exception 'Outing already started'; end if;
  return public.nearby_venues(array[$2],outing.activity,extract(epoch from outing.starts_at),extract(epoch from outing.ends_at));
end;
$$;
create function public.select_outing_venue(target uuid, station_id text, venue_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare outing public.outings; candidate jsonb;
begin
  select * into outing from public.outings where id=$1 for update;
  if not found or outing.owner_id is distinct from auth.uid() or outing.confirmed_venue_id is not null or outing.starts_at<=now() then raise exception 'Cannot edit outing'; end if;
  select item into candidate from jsonb_array_elements(public.nearby_venues(array[$2],outing.activity,extract(epoch from outing.starts_at),extract(epoch from outing.ends_at))) item where item->>'id'=$3;
  if candidate is null then raise exception 'Venue unavailable'; end if;
  update public.outings set selected_venue=candidate,recommendations=null,updated_at=date_trunc('milliseconds',clock_timestamp()) where id=$1;
  return public.get_outing($1);
end;
$$;
revoke execute on function public.list_outing_venues(uuid,text),public.select_outing_venue(uuid,text,text) from public,anon,authenticated;
grant execute on function public.list_outing_venues(uuid,text),public.select_outing_venue(uuid,text,text) to authenticated;
