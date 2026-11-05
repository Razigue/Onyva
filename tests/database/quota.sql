-- Plafond PRIM par personne, réservé au serveur.
reset role;
do $$begin
  if not public.reserve_prim_user_call('00000000-0000-4000-8000-000000000003',1000,2) then raise exception 'Premier appel personnel refusé'; end if;
  if not public.reserve_prim_user_call('00000000-0000-4000-8000-000000000003',1000,2) then raise exception 'Deuxième appel personnel refusé'; end if;
  if public.reserve_prim_user_call('00000000-0000-4000-8000-000000000003',1000,2) then raise exception 'Plafond personnel dépassé'; end if;
  if not public.reserve_prim_user_call('00000000-0000-4000-8000-000000000002',1000,2) then raise exception 'Plafond appliqué à la mauvaise personne'; end if;
  if public.reserve_prim_user_call(null,1000,2) or public.reserve_prim_user_call('00000000-0000-4000-8000-000000000002',1000,0) then raise exception 'Paramètres invalides acceptés'; end if;
end$$;
-- Quota partagé épuisé : l’appel est refusé et ne consomme pas le plafond personnel.
do $$declare used integer;begin
  update public.prim_usage set calls=5 where usage_day=(now() at time zone 'Europe/Paris')::date and api='general';
  if public.reserve_prim_user_call('00000000-0000-4000-8000-000000000001',5,3) then raise exception 'Quota partagé ignoré'; end if;
  select calls into used from public.prim_user_usage where user_id='00000000-0000-4000-8000-000000000001' and usage_day=(now() at time zone 'Europe/Paris')::date;
  if used<>0 then raise exception 'Appel refusé compté pour la personne'; end if;
end$$;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $$begin
  begin perform public.reserve_prim_user_call('00000000-0000-4000-8000-000000000001',1000,100); raise exception 'Plafond personnel accessible au client'; exception when insufficient_privilege then null;end;
  begin perform * from public.prim_user_usage; raise exception 'Compteurs accessibles au client'; exception when insufficient_privilege then null;end;
end$$;
reset role;
