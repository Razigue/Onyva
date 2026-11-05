-- Possession of the random invitation code reveals only this minimal preview.
-- No station, participant list, account ID or route is exposed before joining.
create function public.preview_invitation(invite_code uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', (select p.name from public.participants p where p.outing_id = o.id and p.user_id = o.owner_id),
    'startsAt', to_char(o.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'activity', o.activity,
    'count', (select count(*) from public.participants p where p.outing_id = o.id))
  from public.outings o where o.invite_code = $1 and o.starts_at > now();
$$;
revoke execute on function public.preview_invitation(uuid) from public;
grant execute on function public.preview_invitation(uuid) to anon, authenticated;
