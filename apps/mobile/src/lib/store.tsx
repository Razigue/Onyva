import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Database } from '@onyva/shared/database';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { z } from 'zod';
import { isExpired, outingSchema, recommendationResponseSchema, primCoverageSchema, stationSchema, venueSchema, venueReactionsSchema } from '@onyva/shared';
import type { Outing, RecommendationResponse, Station, VenueReaction, Venue, VenueFilter, PrimCoverage } from '@onyva/shared';
import { ensureSession, supabase } from './supabase';

const cacheKey = 'onyva:current:v1';
// Former local trial outings with simulated journeys. Removed on startup.
const legacyPreviewCacheKey = 'onyva:current:preview:v2';
const nameKey = 'onyva:name';
const cacheSchema = z.object({ outing: outingSchema, results: recommendationResponseSchema.nullable() });
type NewOuting = { startsAt: string; endsAt: string; activity: Outing['activity']; departureId: string; filters?: VenueFilter };
type State = {
  outing: Outing | null; results: RecommendationResponse | null; stations: Station[];
  ready: boolean; busy: boolean; error: string | null; userId: string | null; name: string;
  anonymous: boolean; sessionFailed: boolean; saveName: (name: string) => Promise<void>;
  cached: boolean; create: (input: NewOuting, personName: string) => Promise<Outing>;
  add: (name: string, departureId: string, returnId: string) => Promise<void>;
  remove: (id: string) => Promise<void>; confirm: (venueId: string) => Promise<void>;
  refresh: () => Promise<void>; join: (code: string, name: string, departureId: string, returnId: string) => Promise<void>;
  clear: () => Promise<void>; setError: (error: string | null) => void;
  reactions: VenueReaction[]; react: (venueId: string, liked: boolean) => Promise<void>;
  openOuting: (id: string) => Promise<void>;
  coverage: PrimCoverage | null;
  findVenues: (stationId: string) => Promise<Venue[]>;
  selectVenue: (venue: Venue) => Promise<void>;
  /** Organizer only. Clears the selected venue and restarts the search. */
  setFilters: (filters: VenueFilter) => Promise<void>;
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
  const [name, setName] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [sessionFailed, setSessionFailed] = useState(false);
  const [reactions, setReactions] = useState<VenueReaction[]>([]);
  const [coverage, setCoverage] = useState<PrimCoverage | null>(null);
  const revision = useRef(0);
  const account = useRef<string | null>(null);
  useEffect(() => {
    void AsyncStorage.multiRemove([cacheKey, legacyPreviewCacheKey]).catch(() => undefined);
    void AsyncStorage.getItem(nameKey).then(saved => { if (saved) setName(current => current || saved); }).catch(() => undefined).finally(() => setReady(true));
    if (!supabase) return;
    const client = supabase;
    // Every device gets an invisible anonymous session, so the app works without an account.
    const start = () => { void ensureSession().then(() => setSessionFailed(false)).catch(() => setSessionFailed(true)); };
    const { data } = client.auth.onAuthStateChange((event, session) => {
      const uid = session?.user.id ?? null;
      const changed = account.current !== uid;
      account.current = uid;
      if (changed) { ++revision.current; setResults(null); }
      const generation = revision.current;
      setUserId(uid);
      setAnonymous(session?.user.is_anonymous ?? true);
      setOuting(current => current && !current.participants.some(p => p.userId === uid) ? null : current);
      const given = session?.user.user_metadata.given_name;
      if (typeof given === 'string' && given.trim()) setName(given.trim());
      if (!session && (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT')) setTimeout(start, 0);
      // Restore private cached content only for the current session.
      if (uid && changed) void AsyncStorage.getItem(`${cacheKey}:${uid}`).then(raw => {
        if (account.current !== uid || revision.current !== generation) return;
        const parsed = raw ? cacheSchema.safeParse(JSON.parse(raw)) : null;
        if (parsed?.success && parsed.data.outing.participants.some(person => person.userId === uid) && !isExpired(parsed.data.outing)) { setOuting(parsed.data.outing); setResults(parsed.data.results); setCached(true); }
        else if (raw) void AsyncStorage.removeItem(`${cacheKey}:${uid}`);
      }).catch(() => undefined);
    });
    // Retry while offline or while the service refuses new sessions.
    const timer = setInterval(() => { if (!account.current) start(); }, 15_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active' && !account.current) start(); });
    return () => { data.subscription.unsubscribe(); clearInterval(timer); listener.remove(); };
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
    if (!userId || account.current !== userId || !outing.participants.some(person => person.userId === userId)) return;
    void AsyncStorage.setItem(`${cacheKey}:${userId}`, JSON.stringify({ outing, results })).catch(() => setError('La sauvegarde hors connexion est indisponible.'));
  }, [outing, results, ready, userId]);

  useEffect(() => {
    const expire = () => { if (outing && isExpired(outing)) { setOuting(null); setResults(null); void AsyncStorage.removeItem(`${cacheKey}:${userId}`); } };
    const timer = setInterval(expire, 30_000);
    const listener = AppState.addEventListener('change', expire);
    return () => { clearInterval(timer); listener.remove(); };
  }, [outing, userId]);

  const resultRevision = useRef('');
  const compute = useCallback(async (next: Outing) => {
    if (!next.participants.some(person => person.userId === account.current)) throw new Error('Cette sortie n’est pas liée à ce téléphone.');
    const generation = ++revision.current;
    setOuting(next); setCached(false); setError(null);
    if (next.confirmedVenueId) {
      const saved = recommendationResponseSchema.safeParse(await rpc('get_recommendations', { outing_id: next.id }));
      if (saved.success && generation === revision.current) setResults(saved.data);
      setBusy(false); return;
    }
    const key = `${next.id}:${next.updatedAt}`;
    if (resultRevision.current !== key) setResults(null);
    resultRevision.current = key;
    if (!(next.selectedVenue ? coverage?.manualReady : coverage?.ready)) { setResults(null); setBusy(false); return; }
    if (next.participants.length < 2) { setBusy(false); return; }
    setBusy(true);
    let pending = false;
    try {
      let response: RecommendationResponse;
      if (!supabase) throw new Error('Le service est indisponible.');
      const saved = recommendationResponseSchema.safeParse(await rpc('get_recommendations', { outing_id: next.id }));
      if (saved.success && Date.parse(saved.data.computedAt) > Date.now() - 60_000) {
        response = saved.data;
      } else {
        const { data, error } = await supabase.functions.invoke('recommend', { body: { outingId: next.id } });
        if (error) throw new Error('Les trajets sont indisponibles. Réessaie dans un instant.');
        response = recommendationResponseSchema.parse(data);
      }
      pending = !!response.progress && !['complete','failed'].includes(response.progress.stage);
      if (generation === revision.current) { setResults(response); if (response.progress?.stage === 'failed') setError(response.warnings.join(' ')); }
    } catch (cause) { if (generation === revision.current) setError(cause instanceof z.ZodError ? 'Les données reçues sont incomplètes. Réessaie.' : cause instanceof Error ? cause.message : 'Le calcul a échoué.'); }
    finally { if (generation === revision.current) setBusy(pending); }
  }, [coverage]);

  const refresh = useCallback(async () => {
    if (!outing) return;
    try {
      const next = outingSchema.parse(await rpc('get_outing', { outing_id: outing.id }));
      await compute(next);
    } catch { setError('Tu es peut-être hors connexion. La dernière version reste disponible.'); setCached(true); }
  }, [outing, compute]);

  useEffect(() => {
    if (!outing || !supabase) return;
    // Polling is a fallback that also works when the project has not enabled Realtime.
    const timer = setInterval(() => { void refresh(); }, busy ? 1000 : 15_000);
    return () => clearInterval(timer);
  }, [outing, refresh, busy]);

  const outingId = outing?.id;
  useEffect(() => {
    setReactions([]);
    if (!outingId || !userId) return;
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
  }, [outingId, userId]);

  async function react(venueId: string, liked: boolean) {
    if (!outing || outing.confirmedVenueId || !results?.recommendations.some(r => r.venue.id === venueId)) throw new Error('Actualise les propositions avant de réagir.');
    setReactions(venueReactionsSchema.parse(await rpc('set_venue_reaction', { outing_id: outing.id, venue_id: venueId, liked })));
  }

  async function openOuting(id: string) {
    await compute(outingSchema.parse(await rpc('get_outing', { outing_id: id })));
  }

  async function findVenues(stationId: string) {
    if (!outing) return [];
    return z.array(venueSchema).parse(await rpc('list_outing_venues', { target: outing.id, station_id: stationId }));
  }
  async function selectVenue(venue: Venue) {
    if (!outing) return;
    const next = outingSchema.parse(await rpc('select_outing_venue', { target: outing.id, station_id: venue.stationId, venue_id: venue.id }));
    await compute(next);
  }
  async function setFilters(filters: VenueFilter) {
    if (!outing) return;
    const next = outingSchema.parse(await rpc('set_outing_filters', { target: outing.id, cuisines: filters.cuisines, outdoor_seating: filters.outdoorSeating }));
    await compute(next);
  }
  async function saveName(value: string) {
    const trimmed = value.trim().slice(0, 40);
    if (!trimmed) throw new Error('Indique ton prénom.');
    setName(trimmed);
    await AsyncStorage.setItem(nameKey, trimmed).catch(() => undefined);
  }
  async function create(input: NewOuting, personName: string) {
    if (!personName.trim()) throw new Error('Indique ton prénom.');
    const next = outingSchema.parse(await rpc('create_outing', { payload: { ...input, name: personName.trim() } }));
    await compute(next);
    return next;
  }
  async function add(personName: string, departureId: string, returnId: string) {
    if (!outing) return;
    await compute(outingSchema.parse(await rpc('add_participant', { outing_id: outing.id, person_name: personName, departure_id: departureId, return_id: returnId })));
  }
  async function remove(id: string) {
    if (!outing) return;
    await compute(outingSchema.parse(await rpc('remove_participant', { outing_id: outing.id, participant_id: id })));
  }
  async function confirm(venueId: string) {
    if (!outing || !results?.recommendations.some(r => r.venue.id === venueId)) throw new Error('Actualise les propositions avant de confirmer.');
    setOuting(outingSchema.parse(await rpc('confirm_venue', { outing_id: outing.id, venue_id: venueId })));
  }
  async function join(code: string, personName: string, departureId: string, returnId: string) {
    const resolved = code.length === 8 ? await rpc('resolve_invite_code', { short_code: code }) : code;
    if (typeof resolved !== 'string') throw new Error('Ce code a expiré ou trop de tentatives ont été faites.');
    await compute(outingSchema.parse(await rpc('join_outing', { payload: { inviteCode: resolved, name: personName, departureId, returnId } })));
  }
  async function clear() {
    ++revision.current; setOuting(null); setResults(null);
    await AsyncStorage.multiRemove([cacheKey, legacyPreviewCacheKey, `${cacheKey}:${userId}`]);
  }
  return <Context.Provider value={{ outing, results, stations, ready, busy, error, userId, name, anonymous, sessionFailed, saveName, cached, create, add, remove, confirm, refresh, join, clear, setError, reactions, react, openOuting, coverage, findVenues, selectVenue, setFilters }}>{children}</Context.Provider>;
}

export function useStore() { const value = useContext(Context); if (!value) throw new Error('StoreProvider is missing'); return value; }
