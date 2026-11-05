import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Database } from '@onyva/shared/database';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { AppState } from 'react-native';
import { z } from 'zod';
import { isExpired, outingSchema, previewCacheSchema, recommendationResponseSchema, primCoverageSchema, stationSchema, venueSchema, venueReactionsSchema } from '@onyva/shared';
import type { Outing, Participant, RecommendationResponse, Station, VenueReaction, Venue, PrimCoverage } from '@onyva/shared';
import { previewCatalog, previewData, previewStations } from './preview';
import { demoPlanner } from '@onyva/shared/demo';
import { rankVenues } from '@onyva/fairness';
import { supabase } from './supabase';

const cacheKey = 'onyva:current:v1';
const previewCacheKey = 'onyva:current:preview:v2';
const cacheSchema = z.object({ outing: outingSchema, results: recommendationResponseSchema.nullable() });
type NewOuting = { startsAt: string; endsAt: string; activity: Outing['activity']; departureId: string };
type State = {
  outing: Outing | null; results: RecommendationResponse | null; stations: Station[];
  ready: boolean; busy: boolean; error: string | null; userId: string | null; name: string;
  cached: boolean; create: (input: NewOuting, demo: boolean) => Promise<Outing>;
  add: (name: string, departureId: string, returnId: string) => Promise<void>;
  remove: (id: string) => Promise<void>; confirm: (venueId: string) => Promise<void>;
  refresh: () => Promise<void>; join: (code: string, name: string, departureId: string, returnId: string) => Promise<void>;
  clear: () => Promise<void>; setError: (error: string | null) => void;
  reactions: VenueReaction[]; react: (venueId: string, liked: boolean) => Promise<void>;
  openOuting: (id: string) => Promise<void>;
  coverage: PrimCoverage | null;
  findVenues: (stationId: string) => Promise<Venue[]>;
  selectVenue: (venue: Venue) => Promise<void>;
};
const Context = createContext<State | null>(null);

async function rpc<Name extends keyof Database['public']['Functions']>(name: Name, args: Database['public']['Functions'][Name]['Args']): Promise<unknown> {
  if (!supabase) throw new Error('Les sorties partagées ne sont pas encore disponibles.');
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error('Impossible de mettre à jour la sortie. Vérifie ta connexion et réessaie.');
  return data;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [outing, setOuting] = useState<Outing | null>(null);
  const [results, setResults] = useState<RecommendationResponse | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('Toi');
  const [reactions, setReactions] = useState<VenueReaction[]>([]);
  const [coverage, setCoverage] = useState<PrimCoverage | null>(null);
  const revision = useRef(0);
  const account = useRef<string | null>(null);
  useEffect(() => {
    // Old demo results contain fictional venues. Keep private live caches intact.
    void AsyncStorage.removeItem(cacheKey);
    setOuting(current => current?.mode === 'demo' ? null : current);
    setResults(current => current?.source === 'demo' ? null : current);
    void AsyncStorage.getItem(previewCacheKey).then(raw => {
      if (account.current) return;
      const parsed = raw ? previewCacheSchema.safeParse(JSON.parse(raw)) : null;
      if (parsed?.success && !isExpired(parsed.data.outing) && parsed.data.outing.mode === 'demo') {
        setOuting(parsed.data.outing); setResults(parsed.data.results); setCached(true);
      } else if (raw) void AsyncStorage.removeItem(previewCacheKey);
    }).catch(() => setError('La dernière sortie n’a pas pu être restaurée.')).finally(() => setReady(true));
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user.id ?? null;
      const changed = account.current !== uid;
      account.current = uid;
      if (changed) { ++revision.current; setResults(current => current?.source === 'demo' ? current : null); }
      const generation = revision.current;
      setUserId(uid);
      setOuting(current => current?.mode === 'live' && !current.participants.some(p => p.userId === uid) ? null : current);
      setName(typeof session?.user.user_metadata.given_name === 'string' ? session.user.user_metadata.given_name : 'Toi');
      // Restore private cached content only for the signed-in account.
      if (uid && changed) void AsyncStorage.getItem(`${cacheKey}:${uid}`).then(raw => {
        if (account.current !== uid || revision.current !== generation) return;
        const parsed = raw ? cacheSchema.safeParse(JSON.parse(raw)) : null;
        if (parsed?.success && parsed.data.outing.mode === 'live' && parsed.data.outing.participants.some(person => person.userId === uid) && !isExpired(parsed.data.outing)) { setOuting(parsed.data.outing); setResults(parsed.data.results); setCached(true); }
        else if (raw) void AsyncStorage.removeItem(`${cacheKey}:${uid}`);
      }).catch(() => undefined);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId || !supabase) return;
    let cancelled = false;
    const client = supabase;
    void (async () => {
      const catalog: Station[] = [];
      // PostgREST caps a response at 1,000 rows. The IDFM catalog is larger.
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client.from('stations').select('id,name,longitude,latitude,lines').eq('active',true).order('id').range(offset, offset + 999);
        const parsed = z.array(stationSchema).safeParse(data);
        if (error || !parsed.success) throw new Error('Station catalog unavailable');
        if (cancelled) return;
        catalog.push(...parsed.data);
        if (parsed.data.length < 1000) break;
      }
      if (!catalog.length) throw new Error('Station catalog empty');
      setStations(catalog);
    })().catch(() => { if (!cancelled) setError('Les stations ne sont pas disponibles. Réessaie plus tard.'); });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    setCoverage(null);
    if (!userId || !supabase) return;
    let cancelled = false;
    const client = supabase;
    const load = async () => {
      const result = await client.functions.invoke('recommend', { body: { action: 'coverage' } });
      const parsed = primCoverageSchema.safeParse(result.data);
      if (!cancelled) setCoverage(parsed.success ? parsed.data : { ready:false, provider:'prim', quotaVerified:false, manualReady:false });
    };
    void load().catch(() => { if (!cancelled) setCoverage({ ready:false, provider:'prim', quotaVerified:false, manualReady:false }); });
    const timer = setInterval(() => { void load().catch(() => undefined); }, 5 * 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [userId]);

  useEffect(() => {
    if (!ready || !outing) return;
    if (outing.mode === 'live' && (!userId || account.current !== userId || !outing.participants.some(person => person.userId === userId))) return;
    const key = outing.mode === 'demo' ? previewCacheKey : `${cacheKey}:${userId}`;
    void AsyncStorage.setItem(key, JSON.stringify({ outing, results })).catch(() => setError('La sauvegarde hors connexion est indisponible.'));
  }, [outing, results, ready, userId]);

  useEffect(() => {
    const expire = () => { if (outing && isExpired(outing)) { setOuting(null); setResults(null); void AsyncStorage.removeItem(outing.mode === 'demo' ? previewCacheKey : `${cacheKey}:${userId}`); } };
    const timer = setInterval(expire, 30_000);
    const listener = AppState.addEventListener('change', expire);
    return () => { clearInterval(timer); listener.remove(); };
  }, [outing, userId]);

  const resultRevision = useRef('');
  const compute = useCallback(async (next: Outing) => {
    if (next.mode === 'live' && !next.participants.some(person => person.userId === account.current)) throw new Error('Reconnecte-toi pour retrouver cette sortie.');
    const generation = ++revision.current;
    setOuting(next); setCached(false); setError(null);
    if (next.confirmedVenueId) {
      if (next.mode === 'live') {
        const saved = recommendationResponseSchema.safeParse(await rpc('get_recommendations', { outing_id: next.id }));
        if (saved.success && generation === revision.current) setResults(saved.data);
      }
      setBusy(false); return;
    }
    const key = `${next.id}:${next.updatedAt}`;
    if (resultRevision.current !== key) setResults(null);
    resultRevision.current = key;
    if (next.mode === 'live' && !(next.selectedVenue ? coverage?.manualReady : coverage?.ready)) { setResults(null); setBusy(false); return; }
    if (next.participants.length < 2) { setBusy(false); return; }
    setBusy(true);
    let pending = false;
    try {
      let response: RecommendationResponse;
      if (next.mode === 'demo') {
        await new Promise(resolve => setTimeout(resolve, 50));
        const startsAt = Date.parse(next.startsAt) / 1000;
        const endsAt = Date.parse(next.endsAt) / 1000;
        const { venues } = previewData(startsAt, endsAt, next.activity);
        response = { recommendations: rankVenues({ participants: next.participants, venues, startsAt, endsAt, kind: next.activity, plan: demoPlanner }), computedAt: new Date().toISOString(), source: 'demo', warnings: [`Lieux réels OpenStreetMap, catalogue du ${new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long' }).format(new Date(previewCatalog.fetchedAt))}. Vérifie les horaires du lieu. Trajets et retours simulés.`] };
      } else {
        if (!supabase) throw new Error('Le service est indisponible.');
        const saved = recommendationResponseSchema.safeParse(await rpc('get_recommendations', { outing_id: next.id }));
        if (saved.success && Date.parse(saved.data.computedAt) > Date.now() - 60_000) {
          response = saved.data;
        } else {
          const { data, error } = await supabase.functions.invoke('recommend', { body: { outingId: next.id } });
          if (error) throw new Error('Les trajets sont indisponibles. Réessaie dans un instant.');
          response = recommendationResponseSchema.parse(data);
        }
      }
      pending = !!response.progress && !['complete','failed'].includes(response.progress.stage);
      if (generation === revision.current) { setResults(response); if (response.progress?.stage === 'failed') setError(response.warnings.join(' ')); }
    } catch (cause) { if (generation === revision.current) setError(cause instanceof z.ZodError ? 'Les données reçues sont incomplètes. Réessaie.' : cause instanceof Error ? cause.message : 'Le calcul a échoué.'); }
    finally { if (generation === revision.current) setBusy(pending); }
  }, [coverage]);

  const refresh = useCallback(async () => {
    if (!outing) return;
    try {
      const next = outing.mode === 'demo' ? outing : outingSchema.parse(await rpc('get_outing', { outing_id: outing.id }));
      await compute(next);
    } catch { setError('Tu es peut-être hors connexion. La dernière version reste disponible.'); setCached(true); }
  }, [outing, compute]);

  useEffect(() => {
    if (!outing || outing.mode !== 'live' || !supabase) return;
    // Polling is a fallback that also works when the project has not enabled Realtime.
    const timer = setInterval(() => { void refresh(); }, busy ? 1000 : 15_000);
    return () => clearInterval(timer);
  }, [outing, refresh, busy]);

  const outingId = outing?.id, outingMode = outing?.mode;
  useEffect(() => {
    setReactions([]);
    if (!outingId || outingMode !== 'live' || !userId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const next = venueReactionsSchema.parse(await rpc('get_venue_reactions', { outing_id: outingId }));
        if (!cancelled) setReactions(next);
      } catch { /* Keep the last reactions on a weak connection. */ }
    };
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [outingId, outingMode, userId]);

  async function react(venueId: string, liked: boolean) {
    if (!outing || outing.confirmedVenueId || !results?.recommendations.some(r => r.venue.id === venueId)) throw new Error('Actualise les propositions avant de réagir.');
    if (outing.mode === 'live') {
      setReactions(venueReactionsSchema.parse(await rpc('set_venue_reaction', { outing_id: outing.id, venue_id: venueId, liked })));
    } else {
      setReactions(current => [...current.filter(r => r.venueId !== venueId), ...(liked ? [{ venueId, userId: '00000000-0000-4000-8000-000000000000' }] : [])]);
    }
  }

  async function openOuting(id: string) {
    await compute(outingSchema.parse(await rpc('get_outing', { outing_id: id })));
  }

  async function findVenues(stationId: string) {
    if (!outing || outing.mode !== 'live') return [];
    return z.array(venueSchema).parse(await rpc('list_outing_venues', { target: outing.id, station_id: stationId }));
  }
  async function selectVenue(venue: Venue) {
    if (!outing || outing.mode !== 'live') return;
    const next = outingSchema.parse(await rpc('select_outing_venue', { target: outing.id, station_id: venue.stationId, venue_id: venue.id }));
    await compute(next);
  }
  async function create(input: NewOuting, demo: boolean) {
    const now = new Date().toISOString();
    const next = demo ? outingSchema.parse({ ...input, id: Crypto.randomUUID(), ownerId: 'demo-owner', inviteCode: Crypto.randomUUID(), updatedAt: now, mode: 'demo', confirmedVenueId: null, participants: [{ id: Crypto.randomUUID(), userId: null, name: 'Toi', departureId: input.departureId, returnId: input.departureId }] }) : outingSchema.parse(await rpc('create_outing', { payload: { ...input, name } }));
    await compute(next);
    return next;
  }
  async function updateParticipants(participants: Participant[]) {
    if (!outing || outing.confirmedVenueId) throw new Error('Cette sortie est déjà confirmée.');
    setReactions([]);
    await compute(outingSchema.parse({ ...outing, participants, updatedAt: new Date().toISOString() }));
  }
  async function add(personName: string, departureId: string, returnId: string) {
    if (!outing) return;
    if (outing.mode === 'demo') await updateParticipants([...outing.participants, { id: Crypto.randomUUID(), userId: null, name: personName, departureId, returnId }]);
    else await compute(outingSchema.parse(await rpc('add_participant', { outing_id: outing.id, person_name: personName, departure_id: departureId, return_id: returnId })));
  }
  async function remove(id: string) {
    if (!outing) return;
    if (outing.mode === 'demo') await updateParticipants(outing.participants.filter(p => p.id !== id));
    else await compute(outingSchema.parse(await rpc('remove_participant', { outing_id: outing.id, participant_id: id })));
  }
  async function confirm(venueId: string) {
    if (!outing || !results?.recommendations.some(r => r.venue.id === venueId)) throw new Error('Actualise les propositions avant de confirmer.');
    if (outing.mode === 'live') setOuting(outingSchema.parse(await rpc('confirm_venue', { outing_id: outing.id, venue_id: venueId })));
    else setOuting({ ...outing, confirmedVenueId: venueId, updatedAt: new Date().toISOString() });
  }
  async function join(code: string, personName: string, departureId: string, returnId: string) {
    const resolved = code.length === 8 ? await rpc('resolve_invite_code', { short_code: code }) : code;
    if (typeof resolved !== 'string') throw new Error('Ce code a expiré ou trop de tentatives ont été faites.');
    await compute(outingSchema.parse(await rpc('join_outing', { payload: { inviteCode: resolved, name: personName, departureId, returnId } })));
  }
  async function clear() {
    ++revision.current; setOuting(null); setResults(null);
    await AsyncStorage.multiRemove([cacheKey, previewCacheKey, `${cacheKey}:${userId}`]);
  }
  return <Context.Provider value={{ outing, results, stations: outing?.mode === 'demo' || !userId ? previewStations : stations, ready, busy, error, userId, name, cached, create, add, remove, confirm, refresh, join, clear, setError, reactions, react, openOuting, coverage, findVenues, selectVenue }}>{children}</Context.Provider>;
}

export function useStore() { const value = useContext(Context); if (!value) throw new Error('StoreProvider is missing'); return value; }
