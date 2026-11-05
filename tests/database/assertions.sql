insert into public.stations(id,name,longitude,latitude,lines,active) values('test-a','Station A',2.36,48.86,'[]',true),('test-b','Station B',2.37,48.86,'[]',true);
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
select set_config('test.outing',public.create_outing(jsonb_build_object('name','Organisateur','startsAt',now()+interval '2 hours','endsAt',now()+interval '4 hours','activity','dinner','departureId','test-a'))->>'id',false);
select set_config('test.invite',public.get_outing(current_setting('test.outing')::uuid)->>'inviteCode',false);
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
select public.join_outing(jsonb_build_object('inviteCode',current_setting('test.invite'),'name','Invité','departureId','test-b','returnId','test-a'));
reset role;
select set_config('test.revision',updated_at::text,false) from public.outings where id=current_setting('test.outing')::uuid;
select set_config('test.claim',gen_random_uuid()::text,false);
do $$begin
  if not public.reserve_prim_call('general',2) or not public.reserve_prim_call('general',2) or public.reserve_prim_call('general',2) then raise exception 'Quota partagé incorrect'; end if;
  if public.claim_prim_cache(current_setting('test.outing')::uuid,'same')->>'state'<>'claimed' then raise exception 'Premier appel non acquis'; end if;
  if public.claim_prim_cache(current_setting('test.outing')::uuid,'same')->>'state'<>'pending' then raise exception 'Double appel amont'; end if;
  if not public.claim_prim_calculation(current_setting('test.outing')::uuid,current_setting('test.revision')::timestamptz,current_setting('test.claim')::uuid) then raise exception 'Calcul non acquis'; end if;
  if public.claim_prim_calculation(current_setting('test.outing')::uuid,current_setting('test.revision')::timestamptz,gen_random_uuid()) then raise exception 'Calcul doublonné'; end if;
end$$;
set role authenticated;
do $$begin
  begin perform public.reserve_prim_call('general',100); raise exception 'Quota accessible au client'; exception when insufficient_privilege then null;end;
  begin perform * from public.prim_cache;raise exception 'Cache accessible au client';exception when insufficient_privilege then null;end;
end$$;
reset role;
update public.outings set recommendations=jsonb_build_object('source','prim','computedAt',now(),'progress',jsonb_build_object('stage','returns'),'recommendations',jsonb_build_array(jsonb_build_object('venue',jsonb_build_object('id','venue'),'journeys','[{},{}]'::jsonb))) where id=current_setting('test.outing')::uuid;
set role authenticated;
select public.set_venue_reaction(current_setting('test.outing')::uuid,'venue',true);
reset role;
update public.outings set recommendations=jsonb_build_object('source','prim','computedAt',now(),'progress',jsonb_build_object('stage','returns'),'recommendations','[]'::jsonb) where id=current_setting('test.outing')::uuid;
do $$begin
  if (select count(*) from public.venue_reactions where outing_id=current_setting('test.outing')::uuid)<>1 then raise exception 'Votes effacés par une progression partielle';end if;
end$$;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $$begin
  begin perform public.confirm_venue(current_setting('test.outing')::uuid,'venue');raise exception 'Confirmation prématurée acceptée';exception when raise_exception then if sqlerrm<>'Return verification incomplete' then raise;end if;end;
end$$;
select public.add_participant(current_setting('test.outing')::uuid,'Ami manuel','test-a','test-a');
reset role;
do $$begin
  if public.save_prim_progress(current_setting('test.outing')::uuid,current_setting('test.revision')::timestamptz,current_setting('test.claim')::uuid,'{"source":"prim","progress":{"stage":"complete"}}') then raise exception 'Ancien calcul publié après modification';end if;
  if (select count(*) from public.prim_cache where outing_id=current_setting('test.outing')::uuid)<>1 then raise exception 'Cache des anciens participants supprimé';end if;
end$$;
select set_config('test.short',(select short_code from public.outings where id=current_setting('test.outing')::uuid),false);
set role authenticated;
do $$begin
  if public.resolve_invite_code(current_setting('test.short'))::text<>current_setting('test.invite') then raise exception 'Code court incorrect';end if;
  for i in 1..20 loop perform public.resolve_invite_code(current_setting('test.short'));end loop;
  if public.resolve_invite_code(current_setting('test.short')) is not null then raise exception 'Codes courts sans limitation';end if;
end$$;
reset role;
select set_config('test.batch',gen_random_uuid()::text,false);
insert into public.osm_venues(import_id,id,name,kind,longitude,latitude,open_intervals) values(current_setting('test.batch')::uuid,'near','Café proche','coffee',2.3601,48.86,'[{"start":0,"end":1000}]'),(current_setting('test.batch')::uuid,'far','Café lointain','coffee',2.38,48.86,'[{"start":0,"end":1000}]');
select public.activate_venue_import(current_setting('test.batch')::uuid,2);
do $$begin
  if jsonb_array_length(public.nearby_venues(array['test-a'],'coffee',100,200))<>1 then raise exception 'Filtre PostGIS incorrect';end if;
  if public.nearby_venues(array['test-a'],'coffee',100,200)->0->>'id'<>'near' then raise exception 'Lieu hors périmètre';end if;
  if jsonb_array_length(public.nearby_venues(array_fill('test-b'::text,array[20])||array['test-a'],'coffee',100,200))<>1 then raise exception 'Stations suivantes ignorées sans raison';end if;
  begin perform public.activate_venue_import(gen_random_uuid(),99);raise exception 'Import incomplet accepté';exception when raise_exception then if sqlerrm<>'Incomplete venue import' then raise;end if;end;
end$$;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
do $$begin
  if (select count(*) from public.outings)<>0 then raise exception 'Sortie visible hors du groupe';end if;
end$$;
reset role;
delete from public.outings where id=current_setting('test.outing')::uuid;
do $$begin
  if exists(select 1 from public.prim_cache) or exists(select 1 from public.prim_calculations) then raise exception 'Cache ou calcul non supprimé en cascade';end if;
end$$;
