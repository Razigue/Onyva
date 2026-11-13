-- Stations worth ranking for an outing: active, with at least one venue of the activity open for the whole outing
-- within 240 m, from a catalogue imported less than 8 days ago. Same filters as nearby_venues.
-- The transit engine ranks only these stations, so that the ranking never stops on a station without a venue.
create function public.venue_station_ids(activity_kind text, starts_at_epoch double precision, ends_at_epoch double precision) returns text[] language sql stable security definer set search_path='' as $$
  -- From the open venues to their stations: faster than testing every station.
  select coalesce(array_agg(distinct s.id), '{}')
  from public.osm_venues v
  join public.venue_imports i on i.current_import=v.import_id
  join public.stations s on s.active and extensions.st_dwithin(s.position,v.position,240)
  where i.imported_at>now()-interval '8 days' and v.kind=$1
    and exists(select 1 from jsonb_array_elements(v.open_intervals) hours where (hours->>'start')::double precision<=$2 and (hours->>'end')::double precision>=$3);
$$;
revoke execute on function public.venue_station_ids(text,double precision,double precision) from public,anon,authenticated;
grant execute on function public.venue_station_ids(text,double precision,double precision) to service_role;
