create or replace function public.get_outing(outing_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_member($1) then raise exception 'Not a member'; end if;
  select jsonb_build_object('id', o.id, 'ownerId', o.owner_id, 'inviteCode', o.invite_code, 'shortCode', o.short_code,
    'startsAt', to_char(o.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'endsAt', to_char(o.ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updatedAt', to_char(o.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'selectedVenue', o.selected_venue, 'activity', o.activity, 'confirmedVenueId', o.confirmed_venue_id, 'mode', 'live',
    'participants', (select jsonb_agg(jsonb_build_object('id', p.id, 'userId', p.user_id, 'name', p.name, 'departureId', p.departure_id, 'returnId', p.return_id) order by p.joined_at, p.id) from public.participants p where p.outing_id = o.id)) into result
  from public.outings o where o.id = $1;
  return result;
end;
$$;


