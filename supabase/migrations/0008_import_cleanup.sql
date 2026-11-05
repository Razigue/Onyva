alter table public.osm_venues add column imported_at timestamptz not null default now();
select cron.schedule('clean-incomplete-venue-imports','10 4 * * *',$$
  delete from public.osm_venues where import_id is distinct from (select current_import from public.venue_imports where singleton) and imported_at<now()-interval '1 day';
$$);
