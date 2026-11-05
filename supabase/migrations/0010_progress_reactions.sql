create or replace function public.outing_interactions_changed() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Partial progress must not erase votes for otherwise unchanged candidates.
  if new.recommendations is distinct from old.recommendations and
    (new.recommendations is null or coalesce(new.recommendations->'progress'->>'stage','complete')='complete') then
    delete from public.venue_reactions r where r.outing_id=new.id and not exists(select 1 from jsonb_array_elements(new.recommendations->'recommendations') c where c->'venue'->>'id'=r.venue_id);
  end if;
  if old.confirmed_venue_id is null and new.confirmed_venue_id is not null then
    update public.outing_push_subscriptions set state='pending',available_at=now() where outing_id=new.id and state='idle';
  end if;
  return new;
end;
$$;
