import type { Page } from '@playwright/test';
import type { Outing, Participant, RecommendationResponse, Station, Venue } from '@onyva/shared';

// Synthetic Supabase backend for browser tests. No real account, PRIM call or venue is involved.
export const stations: Station[] = [
  { id: 'stop_area:test:courneuve', name: 'La Courneuve - 8 Mai 1945 (La Courneuve)', latitude: 48.92, longitude: 2.41, lines: [] },
  { id: 'stop_area:test:opera', name: 'Opéra (Paris)', latitude: 48.871, longitude: 2.332, lines: [] },
  { id: 'stop_area:test:nation', name: 'Nation (Paris)', latitude: 48.848, longitude: 2.396, lines: [] },
];
export const venue = (index: number, overrides: Partial<Venue> = {}): Venue => ({
  id: `osm-node-${100 + index}`, name: `Lieu de test ${index + 1}`, stationId: 'stop_area:test:opera', neighborhood: 'Opéra (Paris)', source: 'osm', kind: 'drinks',
  latitude: 48.871, longitude: 2.3321, walkSeconds: 60, openIntervals: [{ start: 0, end: 9999999999 }], ...overrides,
});
const token = (sub: string) => [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub, role: 'authenticated', is_anonymous: true, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
  'fixture',
].join('.');

type Options = { automatic?: boolean; recommendations?: (outing: Outing) => RecommendationResponse['recommendations'] };
export async function mockBackend(page: Page, options: Options = {}) {
  const userId = '00000000-0000-4000-8000-000000000011';
  const now = () => new Date().toISOString();
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: { provider: 'anonymous' }, user_metadata: {}, identities: [], created_at: now() };
  const state = { anonymousSignups: 0, calculations: 0, outing: null as Outing | null, results: null as RecommendationResponse | null };
  const trip = (departure: number) => ({ departure, arrival: departure + 600, duration: 600, legs: [], night: false });
  const journeys = (outing: Outing) => outing.participants.map(person => ({ participantId: person.id, outbound: trip(Date.parse(outing.startsAt) / 1000 - 600), inbound: trip(Date.parse(outing.endsAt) / 1000) }));
  const update = (next: Outing) => { state.outing = { ...next, updatedAt: now() }; return state.outing; };
  await page.route('**/auth/v1/signup**', route => {
    state.anonymousSignups++;
    return route.fulfill({ json: { access_token: token(userId), refresh_token: 'test-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user } });
  });
  await page.route('**/auth/v1/user**', route => route.fulfill({ json: user }));
  await page.route('**/auth/v1/settings**', route => route.fulfill({ json: { external: { google: true, apple: false } } }));
  await page.route('**/functions/v1/recommend', async route => {
    const body = route.request().postDataJSON() as { outingId?: string; action?: string };
    if (!body.outingId) return route.fulfill({ json: { ready: !!options.automatic, provider: 'prim', quotaVerified: true, manualReady: true } });
    if (!state.outing) return route.fulfill({ status: 404, json: { error: 'Sortie introuvable.' } });
    state.calculations++;
    const outing = state.outing;
    const recommendations = outing.selectedVenue
      ? [{ venue: outing.selectedVenue, maximum: 600, sum: 600 * outing.participants.length, spread: 0, journeys: journeys(outing) }]
      : (options.recommendations?.(outing) ?? []);
    state.results = { source: 'prim', computedAt: now(), progress: { stage: 'complete', completed: 1, total: 1 }, warnings: ['Réponse synthétique de test.'], recommendations };
    return route.fulfill({ json: state.results });
  });
  await page.route('**/rest/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
    if (path.endsWith('/stations')) return route.fulfill({ json: stations });
    if (path.endsWith('/create_outing')) {
      const { payload } = body;
      const owner: Participant = { id: '00000000-0000-4000-8000-000000000014', userId, name: payload.name, departureId: payload.departureId, returnId: payload.departureId };
      state.outing = { startsAt: payload.startsAt, endsAt: payload.endsAt, activity: payload.activity, id: '00000000-0000-4000-8000-000000000012', inviteCode: '00000000-0000-4000-8000-000000000013', shortCode: 'ABCD2345', ownerId: userId, mode: 'live', confirmedVenueId: null, selectedVenue: null, updatedAt: now(), participants: [owner] };
      return route.fulfill({ json: state.outing });
    }
    if (path.endsWith('/add_participant') && state.outing) {
      const person: Participant = { id: `00000000-0000-4000-8000-0000000001${state.outing.participants.length}0`, userId: null, name: body.person_name, departureId: body.departure_id, returnId: body.return_id };
      return route.fulfill({ json: update({ ...state.outing, participants: [...state.outing.participants, person] }) });
    }
    if (path.endsWith('/list_outing_venues')) return route.fulfill({ json: [venue(0, { kind: state.outing?.activity ?? 'drinks', name: 'Café du rendez-vous' })] });
    if (path.endsWith('/select_outing_venue') && state.outing) return route.fulfill({ json: update({ ...state.outing, selectedVenue: venue(0, { kind: state.outing.activity, name: 'Café du rendez-vous' }) }) });
    if (path.endsWith('/confirm_venue') && state.outing) return route.fulfill({ json: update({ ...state.outing, confirmedVenueId: body.venue_id }) });
    if (path.endsWith('/get_recommendations')) return route.fulfill({ json: state.results });
    if (path.endsWith('/get_outing')) return route.fulfill({ json: state.outing });
    return route.fulfill({ json: [] });
  });
  return { state, userId, journeys };
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export async function pickStation(page: Page, label: string, query: string, name: string) {
  await page.getByRole('button', { name: new RegExp(`^${escape(label)} :`) }).click();
  await page.getByRole('textbox', { name: 'Rechercher une station', exact: true }).fill(query);
  await page.getByRole('button', { name: new RegExp(`^${escape(name)}`) }).click();
}
