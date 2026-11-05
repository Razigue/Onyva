-- No location table, trigger or database broadcast. HTTP Realtime only.
create policy outing_location_receive on realtime.messages for select to authenticated using (
  extension='broadcast' and exists(select 1 from public.outings o where public.is_member(o.id) and realtime.topic() =
    'outing:'||o.id::text||':'||to_char(o.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
);
create function public.refresh_membership_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.outings set updated_at=date_trunc('milliseconds',clock_timestamp()) where id=old.outing_id;
  return old;
end;
$$;
create trigger membership_revision after delete on public.participants for each row execute function public.refresh_membership_revision();
revoke execute on function public.refresh_membership_revision() from public,anon,authenticated;
