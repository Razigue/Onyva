import { expect, test } from '@playwright/test';
test('invitation shows a short code, copies it on request and preserves the Play referrer', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://localhost:4175',
  });
  await page.route('**/rest/v1/rpc/preview_invitation', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'apikey,authorization,content-type',
      },
      body: JSON.stringify({
        name: 'Inès',
        startsAt: '2026-11-02T18:30:00Z',
        activity: 'dinner',
        count: 2,
        shortCode: 'ABCD2345',
      }),
    }));
  await page.goto('http://localhost:4175/join?code=00000000-0000-4000-8000-000000000001');
  await expect(page.getByText('Ton code : ABCD2345')).toBeVisible();
  const link = await page.getByRole('link', { name: 'Sur Google Play' }).getAttribute('href');
  expect(new URL(link!).searchParams.get('referrer')).toBe('onyva_invite=ABCD2345');
  await page.getByRole('button', { name: 'Copier le code' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Code copié.' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('ABCD2345');
});
test('an expired invitation does not expose a code or store referrer', async ({ page }) => {
  await page.route(
    '**/rest/v1/rpc/preview_invitation',
    (route) =>
      route.fulfill({
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: 'null',
      }),
  );
  await page.goto('http://localhost:4175/join?code=00000000-0000-4000-8000-000000000001');
  await expect(page.getByRole('status').first()).toContainText('expiré');
  await expect(page.getByRole('button', { name: 'Copier le code' })).toHaveCount(0);
});
