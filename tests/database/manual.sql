insert into public.stations(id,name,longitude,latitude,lines,active) values('manual-station','Rendez-vous',2.36,48.86,'[]',true);
select set_config('manual.batch',gen_random_uuid()::text,false);
insert into public.osm_venues(import_id,id,name,kind,longitude,latitude,open_intervals) values
(current_setting('manual.batch')::uuid,'manual-open','Café ouvert','coffee',2.3601,48.86,jsonb_build_array(jsonb_build_object('start',extract(epoch from now()),'end',extract(epoch from now()+interval '1 day')))),
(current_setting('manual.batch')::uuid,'manual-closed','Café sans horaires','coffee',2.3601,48.86,'[]'),
(current_setting('manual.batch')::uuid,'manual-far','Café lointain','coffee',2.39,48.86,jsonb_build_array(jsonb_build_object('start',extract(epoch from now()),'end',extract(epoch from now()+interval '1 day'))));
select public.activate_venue_import(current_setting('manual.batch')::uuid,3);
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
select set_config('manual.outing',public.create_outing(jsonb_build_object('name','Organisateur','startsAt',now()+interval '2 hours','endsAt',now()+interval '4 hours','activity','coffee','departureId','manual-station'))->>'id',false);
select set_config('manual.invite',public.get_outing(current_setting('manual.outing')::uuid)->>'inviteCode',false);
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
select public.join_outing(jsonb_build_object('inviteCode',current_setting('manual.invite'),'name','Invité','departureId','manual-station','returnId','manual-station'));
do $$begin
  if jsonb_array_length(public.list_outing_venues(current_setting('manual.outing')::uuid,'manual-station'))<>1 then raise exception 'Horaires ou distance non filtrés';end if;
  begin perform public.select_outing_venue(current_setting('manual.outing')::uuid,'manual-station','manual-open');raise exception 'Sélection accessible à un invité';exception when raise_exception then if sqlerrm<>'Cannot edit outing' then raise;end if;end;
end$$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
do $$begin
  begin perform public.list_outing_venues(current_setting('manual.outing')::uuid,'manual-station');raise exception 'Catalogue accessible hors sortie';exception when raise_exception then if sqlerrm<>'Not a member' then raise;end if;end;
end$$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $$begin
  begin perform public.select_outing_venue(current_setting('manual.outing')::uuid,'manual-station','manual-closed');raise exception 'Lieu sans horaires accepté';exception when raise_exception then if sqlerrm<>'Venue unavailable' then raise;end if;end;
  begin perform public.select_outing_venue(current_setting('manual.outing')::uuid,'manual-station','manual-far');raise exception 'Lieu éloigné accepté';exception when raise_exception then if sqlerrm<>'Venue unavailable' then raise;end if;end;
end$$;
select public.select_outing_venue(current_setting('manual.outing')::uuid,'manual-station','manual-open');
do $$begin
  if public.get_outing(current_setting('manual.outing')::uuid)->'selectedVenue'->>'id'<>'manual-open' then raise exception 'Choix non partagé';end if;
  begin perform public.confirm_venue(current_setting('manual.outing')::uuid,'manual-open');raise exception 'Lieu non vérifié confirmé';exception when raise_exception then if sqlerrm<>'Refresh recommendations' then raise;end if;end;
end$$;
reset role;
select set_config('manual.revision',updated_at::text,false) from public.outings where id=current_setting('manual.outing')::uuid;
select set_config('manual.claim',gen_random_uuid()::text,false);
select public.claim_prim_calculation(current_setting('manual.outing')::uuid,current_setting('manual.revision')::timestamptz,current_setting('manual.claim')::uuid);
set role authenticated;
select public.add_participant(current_setting('manual.outing')::uuid,'Ami ajouté','manual-station','manual-station');
reset role;
do $$begin
  if public.save_prim_progress(current_setting('manual.outing')::uuid,current_setting('manual.revision')::timestamptz,current_setting('manual.claim')::uuid,'{"source":"prim","progress":{"stage":"complete"}}') then raise exception 'Ancien résultat accepté';end if;
  if (select selected_venue->>'id' from public.outings where id=current_setting('manual.outing')::uuid)<>'manual-open' then raise exception 'Choix effacé à l’adhésion';end if;
end$$;
delete from public.outings where id=current_setting('manual.outing')::uuid;
