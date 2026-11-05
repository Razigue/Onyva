import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
// Account creation with a password is a test fixture on the local stack only.
// The product continues to expose Apple/Google sign-in exclusively.
if (new URL(url).hostname !== '127.0.0.1') throw new Error('This test must only run against local Supabase.');
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

async function session(name: string) {
  const email = `onyva-e2e-${randomUUID()}@example.test`, password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { given_name: name } });
  if (created.error || !created.data.user) throw new Error('Local fixture account creation failed');
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    throw new Error('Local fixture sign-in failed');
  }
  return { session: signed.data.session, client };
}
async function authenticate(context: BrowserContext, value: Session) {
  await context.addInitScript(({ value }) => {
    // Supabase derives the default key from the project hostname (127 here).
    if (!localStorage.getItem('sb-127-auth-token')) localStorage.setItem('sb-127-auth-token', JSON.stringify(value));
  }, { value });
}
async function chooseStation(page: Page, name: string) {
  await page.getByRole('button', { name: /^Ta station de départ :/ }).click();
  await page.getByRole('textbox', { name: 'Rechercher une station' }).fill(name);
  await page.getByRole('button', { name: new RegExp(`^${name} Lignes`) }).first().click();
}

test.skip(!process.env.PRIM_API_KEY || process.env.PRIM_QUOTA_CONFIRMED !== 'true', 'Clé PRIM et quota gratuit confirmé requis pour ce test réel.');

test('two authenticated devices create, join and confirm a real outing through the Edge Function', async ({ browser }) => {
  const owner = await session('Yanis');
  let guest: Awaited<ReturnType<typeof session>> | undefined;
  const contexts: BrowserContext[] = [];
  try {
    guest = await session('Inès');
    const a = await browser.newContext({ baseURL: 'http://localhost:8083', viewport: { width: 390, height: 844 } }); contexts.push(a);
    const b = await browser.newContext({ baseURL: 'http://localhost:8083', viewport: { width: 390, height: 844 } }); contexts.push(b);
    await authenticate(a, owner.session); await authenticate(b, guest.session);
    const host = await a.newPage(), friend = await b.newPage();
    await host.goto('/create');
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    await host.getByRole('textbox', { name: 'Date (AAAA-MM-JJ)', exact: true }).fill(today);
    await host.getByRole('textbox', { name: 'Heure de Paris (HH:MM)', exact: true }).fill('19:30');
    await host.getByTestId('wizard-next').click();
    await host.getByRole('button', { name: /^Un resto/ }).click();
    await host.getByTestId('wizard-next').click();
    await expect(host.getByRole('button', { name: 'Sortie partagée', exact: true })).toBeVisible();
    await chooseStation(host, 'Bastille');
    await host.getByTestId('wizard-next').click();
    await expect(host.getByText('Il ne manque qu’un ami.')).toBeVisible();
    const { data: rows, error } = await owner.client.from('outings').select('id,invite_code');
    expect(error).toBeNull(); expect(rows).toHaveLength(1);
    const outing = rows![0]!;
    const hidden = await guest.client.from('outings').select('id').eq('id', outing.id);
    expect(hidden.data).toEqual([]);
    const unauthorized = await fetch(`${url}/functions/v1/recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outingId: outing.id }) });
    expect(unauthorized.status).toBe(401);
    await friend.goto(`/join?code=${outing.invite_code}`);
    await friend.getByRole('textbox', { name: 'Ton prénom', exact: true }).fill('Inès');
    await chooseStation(friend, 'Nation');
    await friend.getByRole('button', { name: 'Je rejoins la bande', exact: true }).click();
    await expect(friend.getByText('SORTIE PARTAGÉE')).toBeVisible();
    await expect(friend.getByText('Le plus équilibré', { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(friend.getByRole('link', { name: /Consulter les avis Google/ }).first()).toBeVisible();
    await expect(friend.getByText('Lieu fictif', { exact: true })).toHaveCount(0);
    await expect(host.getByText('Inès', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    const reaction = friend.getByRole('button', { name: /^Ça me plaît :/ }).first();
    await reaction.click();
    await expect(reaction).toHaveAttribute('aria-pressed', 'true');
    await expect(host.getByRole('button', { name: /^Ça me plaît :/ }).first()).toContainText('1', { timeout: 30_000 });
    await host.getByRole('button', { name: 'On se retrouve ici', exact: true }).click();
    await expect(host.getByRole('heading', { name: 'C’est décidé. On y va !' })).toBeVisible();
    await expect(friend.getByRole('heading', { name: 'C’est décidé. On y va !' })).toBeVisible({ timeout: 30_000 });
    await expect(friend.getByRole('button', { name: /^Ça me plaît :/ }).first()).toBeDisabled();
    await expect(friend.getByRole('button', { name: 'Ajouter au calendrier' })).toBeVisible();
    await host.reload();
    await expect(host.getByRole('heading', { name: 'C’est décidé. On y va !' })).toBeVisible();
    await a.setOffline(true);
    await host.getByRole('link', { name: 'À la une', exact: true }).click();
    await host.getByRole('link', { name: 'Ma sortie', exact: true }).click();
    await expect(host.getByRole('heading', { name: 'C’est décidé. On y va !' })).toBeVisible();
    await a.setOffline(false);
    await host.goto('/account');
    await host.getByRole('button', { name: 'Supprimer mon compte', exact: true }).click();
    await host.getByRole('button', { name: 'Confirmer la suppression', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Continuer avec Google', exact: true })).toBeVisible();
    const removed = await guest.client.rpc('get_outing', { outing_id: outing.id });
    expect(removed.error).not.toBeNull();
  } finally {
    for (const context of contexts) await context.close();
    if (guest) await admin.auth.admin.deleteUser(guest.session.user.id);
    await admin.auth.admin.deleteUser(owner.session.user.id);
  }
});
