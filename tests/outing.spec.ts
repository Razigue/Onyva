import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Outing, RecommendationResponse, Venue } from '@onyva/shared';

async function scheduleEvening(page: Page) {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86400_000).toISOString().slice(0, 10);
  await page.getByRole('textbox', { name: 'Date (AAAA-MM-JJ)', exact: true }).fill(tomorrow);
  await page.getByRole('textbox', { name: 'Heure de Paris (HH:MM)', exact: true }).fill('19:30');
}

test('create, add a friend, compare, confirm and restore offline', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('On se retrouve', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: `test-results/home-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'On organise ça' }).click();
  await scheduleEvening(page);
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('wizard-next').click();
  await expect(page.getByText('Il ne manque qu’un ami.')).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter un ami', exact: true }).click();
  await page.getByRole('textbox', { name: 'Son prénom', exact: true }).fill('Inès');
  await page.getByRole('button', { name: 'Ajouter au groupe' }).click();
  await expect(page.getByText('Le plus équilibré', { exact: true })).toBeVisible();
  await expect(page.getByText('Retour simulé pour tout le monde').first()).toBeVisible();
  await expect(page.getByText('OpenStreetMap', { exact: true }).first()).toBeVisible();
  expect(await page.getByText('OpenStreetMap', { exact: true }).count()).toBeLessThanOrEqual(6);
  await expect(page.getByText('Lieu fictif', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Consulter les avis Google/ }).first()).toBeVisible();
  await page.screenshot({ path: `test-results/results-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Voir les trajets aller et retour' }).first().click();
  await expect(page.getByText('Aller ·', { exact: false }).first()).toBeVisible();
  const reaction = page.getByRole('button', { name: /^Ça me plaît :/ }).first();
  await reaction.click(); await expect(reaction).toHaveAttribute('aria-pressed', 'true');
  await reaction.click(); await expect(reaction).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.getByText('Le plus équilibré', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'On se retrouve ici' }).click();
  await expect(page.getByRole('heading', { name: 'C’est décidé. On y va !' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ajouter au calendrier' }).click();
  expect((await download).suggestedFilename()).toBe('onyva.ics');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'C’est décidé. On y va !' })).toBeVisible();
  await page.context().setOffline(true);
  await page.getByRole('link', { name: 'À la une', exact: true }).click();
  await page.getByRole('link', { name: 'Ma sortie', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'C’est décidé. On y va !' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter un ami', exact: true })).toHaveCount(0);
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport);
  expect(errors).toEqual([]);
});

test('older fictional outings are discarded without showing an invented venue', async ({ page }) => {
  const now = Date.now();
  const cache = {
    outing: { id: '00000000-0000-4000-8000-000000000001', ownerId: 'demo-owner', inviteCode: '00000000-0000-4000-8000-000000000002', startsAt: new Date(now + 3600_000).toISOString(), endsAt: new Date(now + 12600_000).toISOString(), activity: 'drinks', participants: [{ id: 'p', userId: null, name: 'Toi', departureId: 'bastille', returnId: 'bastille' }], confirmedVenueId: 'old-fake', updatedAt: new Date(now).toISOString(), mode: 'demo' },
    results: { recommendations: [{ venue: { id: 'old-fake', name: 'Ancien lieu fictif', stationId: 'republique', neighborhood: 'Paris', kind: 'drinks', walkSeconds: 120, latitude: 48.86, longitude: 2.36, openIntervals: [], source: 'demo' }, journeys: [], maximum: 0, sum: 0, spread: 0 }], computedAt: new Date(now).toISOString(), source: 'demo', warnings: [] },
  };
  await page.addInitScript(value => localStorage.setItem('onyva:current:v1', JSON.stringify(value)), cache);
  await page.goto('/outing');
  await expect(page.getByText('La prochaine sortie commence ici.', { exact: true })).toBeVisible();
  await expect(page.getByText('Ancien lieu fictif', { exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('onyva:current:v1'))).toBeNull();
});

test('an invalid date has a recoverable error state', async ({ page }) => {
  await page.goto('/create');
  await page.getByRole('textbox', { name: 'Date (AAAA-MM-JJ)', exact: true }).fill('2020-01-01');
  await page.getByTestId('wizard-next').click();
  await expect(page.getByText('Choisis une date et une heure à venir, à l’heure de Paris.')).toBeVisible();
});

test('dinner offers twelve real venues with cuisine filters and external review links', async ({ page }) => {
  await page.goto('/create');
  await scheduleEvening(page);
  await page.getByTestId('wizard-next').click();
  await page.getByText('Un resto', { exact: true }).click();
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('wizard-next').click();
  await page.getByRole('button', { name: 'Ajouter un ami', exact: true }).click();
  await page.getByRole('textbox', { name: 'Son prénom', exact: true }).fill('Inès');
  await page.getByRole('button', { name: 'Ajouter au groupe' }).click();
  await expect(page.getByText('OpenStreetMap', { exact: true })).toHaveCount(12);
  await expect(page.getByText('Le plus équilibré', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Chinois', exact: true }).click();
  await expect(page.getByText('OpenStreetMap', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Tous les restos', exact: true }).click();
  await expect(page.getByText('OpenStreetMap', { exact: true })).toHaveCount(12);
  await expect(page.getByRole('link', { name: /Consulter les avis Google/ })).toHaveCount(12);
  await expect(page.getByText('Lieu fictif', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Les lieux sont réels.', { exact: false }).first()).toBeVisible();
});


test('a shared outing can be created while automatic recommendations are paused', async ({ page }) => {
  const userId = '00000000-0000-4000-8000-000000000011';
  const now = new Date().toISOString();
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { given_name: 'Test' }, created_at: now };
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })).toString('base64url'), 'fixture'].join('.');
  await page.addInitScript(({ user, token }) => {
    const fixture = JSON.stringify({ access_token: token, refresh_token: 'test-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user });
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key: string) {
      return /^sb-.*-auth-token$/.test(key) ? fixture : getItem.call(this, key);
    };
  }, { user, token });
  await page.route('**/auth/v1/user', route => route.fulfill({ json: user }));
  let created = false, calculations = 0;
  let savedOuting: Outing | null = null, savedResults: RecommendationResponse | null = null;
  const venue: Venue = { id: 'osm-node-123', name: 'Café du rendez-vous', stationId: 'station-test', neighborhood: 'Station de test', source: 'osm', kind: 'drinks', latitude: 48.85, longitude: 2.3501, walkSeconds: 60, openIntervals: [{ start: 0, end: 9999999999 }] };
  await page.route('**/functions/v1/recommend', async route => {
    if (!route.request().postDataJSON()?.outingId) return route.fulfill({ json: { ready: false, provider: 'prim', quotaVerified: true, manualReady: true } });
    calculations++;
    if (!savedOuting?.selectedVenue) throw new Error('Calculation started without a selected venue');
    const at = Date.parse(savedOuting.startsAt) / 1000, end = Date.parse(savedOuting.endsAt) / 1000;
    const trip = (departure: number) => ({ departure, arrival: departure + 600, duration: 600, legs: [], night: false });
    savedResults = { source: 'prim', computedAt: new Date().toISOString(), progress: { stage: 'complete', completed: 1, total: 1 }, warnings: ['Lieu choisi manuellement.'], recommendations: [{ venue, maximum: 600, sum: 1200, spread: 0, journeys: savedOuting.participants.map(person => ({ participantId: person.id, outbound: trip(at - 600), inbound: trip(end) })) }] };
    return route.fulfill({ json: savedResults });
  });
  await page.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/stations')) return route.fulfill({ json: [{ id: 'station-test', name: 'Station de test', latitude: 48.85, longitude: 2.35, lines: [] }] });
    if (url.pathname.endsWith('/create_outing')) {
      created = true;
      const { payload } = route.request().postDataJSON();
      savedOuting = { ...payload, id: '00000000-0000-4000-8000-000000000012', inviteCode: '00000000-0000-4000-8000-000000000013', ownerId: userId, mode: 'live', confirmedVenueId: null, updatedAt: now, participants: [{ id: '00000000-0000-4000-8000-000000000014', userId, name: 'Test', departureId: 'station-test', returnId: 'station-test' }, { id: '00000000-0000-4000-8000-000000000015', userId: null, name: 'Ami', departureId: 'station-test', returnId: 'station-test' }] };
      return route.fulfill({ json: savedOuting });
    }
    if (url.pathname.endsWith('/list_outing_venues')) return route.fulfill({ json: [venue] });
    if (url.pathname.endsWith('/select_outing_venue') && savedOuting) {
      savedOuting = { ...savedOuting, selectedVenue: venue, updatedAt: new Date().toISOString() };
      return route.fulfill({ json: savedOuting });
    }
    if (url.pathname.endsWith('/confirm_venue') && savedOuting) {
      savedOuting = { ...savedOuting, confirmedVenueId: venue.id, updatedAt: new Date().toISOString() };
      return route.fulfill({ json: savedOuting });
    }
    if (url.pathname.endsWith('/get_recommendations')) return route.fulfill({ json: savedResults });
    if (url.pathname.endsWith('/get_outing')) return route.fulfill({ json: savedOuting });
    return route.fulfill({ json: [] });
  });
  await page.goto('/create');
  await scheduleEvening(page);
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('wizard-next').click();
  await expect(page.getByRole('button', { name: 'Sortie partagée', exact: true })).toBeVisible();
  await expect(page.getByText('La recherche automatique de lieu est en pause.', { exact: false })).toBeVisible();
  await page.getByTestId('wizard-next').click();
  await expect(page.getByText('SORTIE PARTAGÉE', { exact: true })).toBeVisible();
  await expect(page.getByText('L’organisateur peut choisir un lieu et faire vérifier les allers et retours.', { exact: false })).toBeVisible();
  expect(created).toBe(true);
  expect(calculations).toBe(0);
  await expect(page.getByText('Le calcul des trajets est indisponible.', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Voir les lieux ouverts', exact: true }).click();
  await page.getByRole('button', { name: 'Vérifier les trajets vers Café du rendez-vous', exact: true }).click();
  await expect(page.getByText('Lieu choisi par le groupe', { exact: true })).toBeVisible();
  await expect(page.getByText('Le plus équilibré', { exact: true })).toHaveCount(0);
  expect(calculations).toBe(1);
  await page.getByRole('button', { name: 'Choisir ce lieu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'C’est décidé. On y va !' })).toBeVisible();
});


test('only configured sign-in providers are offered', async ({ page }) => {
  await page.route('**/auth/v1/settings', route => route.fulfill({ json: { external: { google: true, apple: false } } }));
  await page.goto('/account');
  await expect(page.getByRole('button', { name: 'Continuer avec Google', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuer avec Apple', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Rejoindre avec un code', exact: true }).click();
  await page.getByRole('textbox', { name: 'Code d’invitation', exact: true }).fill('ABCD2345');
  await expect(page.getByRole('button', { name: 'Continuer avec Google', exact: true })).toBeVisible();
});
