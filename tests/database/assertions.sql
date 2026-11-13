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
insert into public.osm_venues(import_id,id,name,kind,longitude,latitude,open_intervals,cuisines,outdoor_seating) values(current_setting('test.batch')::uuid,'resto-cn','Restaurant chinois','dinner',2.3601,48.8601,'[{"start":0,"end":1000}]','["chinese"]',true),(current_setting('test.batch')::uuid,'resto-fr','Restaurant français','dinner',2.3602,48.86,'[{"start":0,"end":1000}]','["french"]',null);
select public.activate_venue_import(current_setting('test.batch')::uuid,4);
do $$begin
  if jsonb_array_length(public.nearby_venues(array['test-a'],'coffee',100,200))<>1 then raise exception 'Filtre PostGIS incorrect';end if;
  if public.nearby_venues(array['test-a'],'coffee',100,200)->0->>'id'<>'near' then raise exception 'Lieu hors périmètre';end if;
  if jsonb_array_length(public.nearby_venues(array_fill('test-b'::text,array[20])||array['test-a'],'coffee',100,200))<>1 then raise exception 'Stations suivantes ignorées sans raison';end if;
  if jsonb_array_length(public.nearby_venues(array['test-a','test-b'],'coffee',100,200,3))<>1 then raise exception 'Station sans lieu ouvert comptée';end if;
  if public.venue_station_ids('coffee',100,200)<>array['test-a'] then raise exception 'Stations avec lieu ouvert incorrectes';end if;
  if cardinality(public.venue_station_ids('coffee',100,2000))<>0 then raise exception 'Station gardée hors des horaires';end if;
  if cardinality(public.venue_station_ids('drinks',100,200))<>0 then raise exception 'Station gardée pour une autre activité';end if;
  if has_function_privilege('authenticated','public.venue_station_ids(text,double precision,double precision,text[],boolean)','execute') then raise exception 'Stations avec lieu ouvert accessibles au client';end if;
  if has_function_privilege('authenticated','public.nearby_venues(text[],text,double precision,double precision,integer,text[],boolean)','execute') then raise exception 'Lieux proches accessibles au client';end if;
  -- Search filters: any of the chosen cuisines for dinner only, a documented terrace when asked.
  if jsonb_array_length(public.nearby_venues(array['test-a'],'dinner',100,200))<>2 then raise exception 'Restaurants sans filtre incorrects';end if;
  if public.nearby_venues(array['test-a'],'dinner',100,200,1,array['chinese','japanese'])->0->>'id'<>'resto-cn' or jsonb_array_length(public.nearby_venues(array['test-a'],'dinner',100,200,1,array['chinese','japanese']))<>1 then raise exception 'Filtre de cuisine incorrect';end if;
  if cardinality(public.venue_station_ids('dinner',100,200,array['italian']))<>0 then raise exception 'Station gardée sans la cuisine demandée';end if;
  if public.venue_station_ids('dinner',100,200,array['french'])<>array['test-a'] then raise exception 'Station perdue avec la cuisine demandée';end if;
  if jsonb_array_length(public.nearby_venues(array['test-a'],'dinner',100,200,1,'{}',true))<>1 or public.nearby_venues(array['test-a'],'dinner',100,200,1,'{}',true)->0->>'outdoorSeating'<>'true' then raise exception 'Terrasse inconnue ou absente acceptée';end if;
  if jsonb_array_length(public.nearby_venues(array['test-a'],'coffee',100,200,1,array['italian']))<>1 then raise exception 'Cuisine appliquée hors restaurant';end if;
  if cardinality(public.venue_station_ids('coffee',100,200,'{}',true))<>0 then raise exception 'Café sans terrasse renseignée gardé';end if;
  begin perform public.activate_venue_import(gen_random_uuid(),99);raise exception 'Import incomplet accepté';exception when raise_exception then if sqlerrm<>'Incomplete venue import' then raise;end if;end;
end$$;
-- Filters of the outing: organizer only, deduplicated, known cuisines, and a new revision that clears the results.
update public.outings set selected_venue='{"id":"venue"}',recommendations='{"source":"prim"}' where id=current_setting('test.outing')::uuid;
select set_config('test.revision',updated_at::text,false) from public.outings where id=current_setting('test.outing')::uuid;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
do $$begin
  if public.get_outing(current_setting('test.outing')::uuid)->'filters'<>'{"cuisines":[],"outdoorSeating":false}'::jsonb then raise exception 'Filtres absents de la sortie';end if;
  begin perform public.set_outing_filters(current_setting('test.outing')::uuid,array['chinese'],true);raise exception 'Filtres modifiés par un invité';exception when raise_exception then if sqlerrm<>'Cannot edit outing' then raise;end if;end;
end$$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $$declare result jsonb;begin
  result:=public.set_outing_filters(current_setting('test.outing')::uuid,array['chinese','chinese'],true);
  if result->'filters'<>'{"cuisines":["chinese"],"outdoorSeating":true}'::jsonb then raise exception 'Filtres mal enregistrés';end if;
  if result->'selectedVenue'<>'null'::jsonb then raise exception 'Lieu choisi gardé après un changement de filtre';end if;
  begin perform public.set_outing_filters(current_setting('test.outing')::uuid,array['sushi'],false);raise exception 'Cuisine inconnue acceptée';exception when check_violation then null;end;
end$$;
reset role;
do $$begin
  if (select recommendations is not null or updated_at=current_setting('test.revision')::timestamptz from public.outings where id=current_setting('test.outing')::uuid) then raise exception 'Résultats gardés après un changement de filtre';end if;
end$$;
select set_config('test.revision',updated_at::text,false) from public.outings where id=current_setting('test.outing')::uuid;
set role authenticated;
select public.set_outing_filters(current_setting('test.outing')::uuid,array['chinese'],true);
select set_config('test.second',(public.create_outing(jsonb_build_object('name','Organisateur','startsAt',now()+interval '2 hours','endsAt',now()+interval '4 hours','activity','dinner','departureId','test-a','filters',jsonb_build_object('cuisines',jsonb_build_array('french','french'),'outdoorSeating',true)))->'filters')::text,false);
reset role;
do $$begin
  if (select updated_at<>current_setting('test.revision')::timestamptz from public.outings where id=current_setting('test.outing')::uuid) then raise exception 'Révision changée sans changement de filtre';end if;
  if current_setting('test.second')::jsonb<>'{"cuisines":["french"],"outdoorSeating":true}'::jsonb then raise exception 'Filtres de création mal enregistrés';end if;
end$$;
delete from public.outings where owner_id='00000000-0000-4000-8000-000000000001' and id<>current_setting('test.outing')::uuid;
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
