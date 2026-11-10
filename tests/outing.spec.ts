import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Cuisine } from '@onyva/shared';
import { mockBackend, pickStation, venue } from './support/backend';

// No typing: the day and the time are chosen by touch.
async function scheduleEvening(page: Page) {
  await page.getByRole('button', { name: 'Demain', exact: true }).click();
  await page.getByRole('button', { name: '19 h 30', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /AAAA-MM-JJ|HH:MM/ })).toHaveCount(0);
}
async function createOuting(page: Page, kind = 'Un verre') {
  await page.goto('/create');
  await scheduleEvening(page);
  await page.getByTestId('wizard-next').click();
  await page.getByText(kind, { exact: true }).click();
  await page.getByTestId('wizard-next').click();
  await page.getByRole('textbox', { name: 'Ton prénom', exact: true }).fill('Sam');
  await pickStation(page, 'Ta station de départ', 'courneuve', 'La Courneuve - 8 Mai 1945 (La Courneuve)');
  await page.getByTestId('wizard-next').click();
  await expect(page.getByText('SORTIE PARTAGÉE', { exact: true })).toBeVisible();
}
async function addFriend(page: Page) {
  await page.getByRole('button', { name: 'Ajouter un ami', exact: true }).click();
  await page.getByRole('textbox', { name: 'Son prénom', exact: true }).fill('Inès');
  await pickStation(page, 'Son départ', 'nation', 'Nation (Paris)');
  await page.getByRole('button', { name: 'Ajouter au groupe' }).click();
}

test('an outing is created, shared, checked and confirmed without any account', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const backend = await mockBackend(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'On sort quand ?' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'J’ai un code', exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/home-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Organiser', exact: true }).click();
  await scheduleEvening(page);
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('wizard-next').click();
  await expect(page.getByRole('button', { name: /Continuer avec/ })).toHaveCount(0);
  await expect(page.getByText('Essai local', { exact: true })).toHaveCount(0);
  await page.getByTestId('wizard-next').click();
  await expect(page.getByText('Choisis ta station de départ.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Ton prénom', exact: true }).fill('Sam');
  await pickStation(page, 'Ta station de départ', 'courneuve', 'La Courneuve - 8 Mai 1945 (La Courneuve)');
  await page.getByTestId('wizard-next').click();
  await expect(page.getByText('SORTIE PARTAGÉE', { exact: true })).toBeVisible();
  expect(backend.state.anonymousSignups).toBe(1);
  expect(backend.state.outing?.participants[0]?.name).toBe('Sam');
  await expect(page.getByText('La Courneuve - 8 Mai 1945 (La Courneuve)', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Code d’invitation : ABCD2345')).toBeVisible();
  await addFriend(page);
  await expect(page.getByText('Inès', { exact: true })).toBeVisible();
  expect(backend.state.calculations).toBe(0);
  await pickStation(page, 'Station de rendez-vous', 'opera', 'Opéra (Paris)');
  await page.getByRole('button', { name: 'Voir les lieux ouverts', exact: true }).click();
  await page.getByRole('button', { name: 'Vérifier les trajets vers Café du rendez-vous', exact: true }).click();
  await expect(page.getByText('Lieu choisi par le groupe', { exact: true })).toBeVisible();
  await expect(page.getByText('Le plus équilibré', { exact: true })).toHaveCount(0);
  expect(backend.state.calculations).toBe(1);
  await page.getByRole('button', { name: 'Choisir ce lieu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'C’est décidé. On y va !' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ajouter au calendrier' }).click();
  expect((await download).suggestedFilename()).toBe('onyva.ics');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'C’est décidé. On y va !' })).toBeVisible();
  expect(backend.state.anonymousSignups).toBe(1);
  await page.context().setOffline(true);
  await page.getByRole('link', { name: 'À la une', exact: true }).click();
  await expect(page.getByText('TA PROCHAINE SORTIE', { exact: true })).toBeVisible();
  await expect(page.getByText('Confirmée', { exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/home-outing-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('link', { name: 'Ma sortie', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'C’est décidé. On y va !' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter un ami', exact: true })).toHaveCount(0);
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport);
  expect(errors).toEqual([]);
});

test('former local trials with simulated journeys are discarded', async ({ page }) => {
  await mockBackend(page);
  const now = Date.now();
  const cache = {
    outing: { id: '00000000-0000-4000-8000-000000000001', ownerId: 'demo-owner', inviteCode: '00000000-0000-4000-8000-000000000002', startsAt: new Date(now + 3600_000).toISOString(), endsAt: new Date(now + 12600_000).toISOString(), activity: 'drinks', participants: [{ id: 'p', userId: null, name: 'Toi', departureId: 'bastille', returnId: 'bastille' }], confirmedVenueId: 'old-fake', updatedAt: new Date(now).toISOString(), mode: 'demo' },
    results: { recommendations: [], computedAt: new Date(now).toISOString(), source: 'demo', warnings: [] },
  };
  await page.addInitScript(value => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('onyva:current:preview:v2', JSON.stringify(value)); localStorage.setItem('onyva:current:v1', JSON.stringify(value)); } }, cache);
  await page.goto('/outing');
  await expect(page.getByText('La prochaine sortie commence ici.', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => [localStorage.getItem('onyva:current:preview:v2'), localStorage.getItem('onyva:current:v1')])).toEqual([null, null]);
});

test('a slot that has passed has a recoverable error state', async ({ page }) => {
  // Thursday 12 November 2026, 16:50 in Paris: 18 h is the first slot at least one hour ahead.
  await page.clock.install({ time: new Date('2026-11-12T15:50:00Z') });
  await mockBackend(page);
  await page.goto('/create');
  await page.getByRole('button', { name: 'Ce soir', exact: true }).click();
  await page.getByRole('button', { name: '18 h', exact: true }).click();
  await page.screenshot({ path: `test-results/create-when-${test.info().project.name}.png`, fullPage: true });
  await page.clock.fastForward('02:00:00');
  await page.getByTestId('wizard-next').click();
  await expect(page.getByText('Choisis une date et une heure à venir, à l’heure de Paris.')).toBeVisible();
  await page.getByRole('button', { name: 'Demain', exact: true }).click();
  await page.getByTestId('wizard-next').click();
  await expect(page.getByRole('heading', { name: 'Qu’est-ce qui te ferait plaisir ?' })).toBeVisible();
});

test('automatic dinner results keep twelve venues with cuisine filters and review links', async ({ page }) => {
  const cuisines: Cuisine[] = ['chinese', 'italian', 'french'];
  await mockBackend(page, {
    automatic: true,
    recommendations: outing => Array.from({ length: 12 }, (_, i) => ({ venue: venue(i, { kind: 'dinner', cuisines: [cuisines[i % 3]!] }), maximum: 600 + i * 60, sum: 1200 + i * 60, spread: i * 30, journeys: outing.participants.map(person => ({ participantId: person.id, outbound: { departure: 0, arrival: 600, duration: 600, legs: [], night: false }, inbound: { departure: 0, arrival: 600, duration: 600, legs: [], night: false } })) })),
  });
  await createOuting(page, 'Un resto');
  await expect(page.getByText('Il ne manque qu’un ami.')).toBeVisible();
  await addFriend(page);
  await expect(page.getByText('OpenStreetMap', { exact: true })).toHaveCount(12);
  await expect(page.getByText('Le plus équilibré', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Chinois', exact: true }).click();
  await expect(page.getByText('OpenStreetMap', { exact: true })).toHaveCount(4);
  await page.getByRole('button', { name: 'Tous les restos', exact: true }).click();
  await expect(page.getByText('OpenStreetMap', { exact: true })).toHaveCount(12);
  await expect(page.getByRole('link', { name: /Consulter les avis Google/ })).toHaveCount(12);
  await page.screenshot({ path: `test-results/results-${test.info().project.name}.png`, fullPage: true });
});

test('a guest joins with a code without signing in, and an account can be linked later', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/account');
  await expect(page.getByRole('button', { name: 'Relier mon compte Google', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continuer avec Google', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Apple/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Me déconnecter', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Rejoindre avec un code', exact: true }).click();
  await page.getByRole('textbox', { name: 'Code d’invitation', exact: true }).fill('ABCD2345');
  await expect(page.getByRole('textbox', { name: 'Ton prénom', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Continuer avec/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Je rejoins la bande', exact: true })).toBeDisabled();
});
