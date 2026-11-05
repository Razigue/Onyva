drop function public.nearby_venues(text[],text);
create function public.nearby_venues(station_ids text[],activity_kind text,starts_at_epoch double precision,ends_at_epoch double precision) returns jsonb language sql stable security definer set search_path='' as $$
  with chosen_station as (
    select s.* from unnest($1[1:20000]) with ordinality ranked(id,position)
    join public.stations s on s.id=ranked.id and s.active
    where exists(
      select 1 from public.osm_venues v join public.venue_imports i on i.current_import=v.import_id
      where i.imported_at>now()-interval '8 days' and v.kind=$2 and extensions.st_dwithin(s.position,v.position,240)
        and exists(select 1 from jsonb_array_elements(v.open_intervals) hours where (hours->>'start')::double precision<=$3 and (hours->>'end')::double precision>=$4)
    ) order by ranked.position limit 1
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'kind',v.kind,'stationId',s.id,'neighborhood',s.name,
    'longitude',v.longitude,'latitude',v.latitude,'cuisines',v.cuisines,'openIntervals',v.open_intervals,'source','osm',
    'walkSeconds',ceil(extensions.st_distance(s.position,v.position)*1.5/1.2)::integer)),'[]'::jsonb)
  from chosen_station s cross join lateral (
    select v.* from public.osm_venues v join public.venue_imports i on i.current_import=v.import_id
    where v.kind=$2 and extensions.st_dwithin(s.position,v.position,240)
      and exists(select 1 from jsonb_array_elements(v.open_intervals) hours where (hours->>'start')::double precision<=$3 and (hours->>'end')::double precision>=$4)
    order by extensions.st_distance(s.position,v.position),v.id limit 30
  ) v;
$$;
revoke execute on function public.nearby_venues(text[],text,double precision,double precision) from public,anon,authenticated;
grant execute on function public.nearby_venues(text[],text,double precision,double precision) to service_role;
