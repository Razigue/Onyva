create or replace function public.refresh_membership_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.outings set updated_at=date_trunc('milliseconds',clock_timestamp()),
    recommendations=case when confirmed_venue_id is null then null else recommendations end
    where id=old.outing_id;
  return old;
end;
$$;
