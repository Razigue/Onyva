import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mockBackend, pickStation } from './support/backend';

// Phone layout: every control has a spoken name and a touch area of at least 44 × 44 points (DESIGN.md).
test.skip(({ isMobile }) => !isMobile, 'Touch targets are checked on the phone layout.');

async function audit(page: Page, screen: string) {
  const problems = await page.evaluate(() => {
    const found: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[role="button"], [role="link"], a[href], button, input, [role="textbox"]'))) {
      const box = el.getBoundingClientRect(), style = getComputedStyle(el);
      if (!box.width || !box.height || style.visibility === 'hidden' || el.closest('[aria-hidden="true"]')) continue;
      const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
      if (!name) found.push(`sans nom : <${el.tagName.toLowerCase()} role=${el.getAttribute('role')}>`);
      if (box.width < 44 || box.height < 44) found.push(`trop petit (${Math.round(box.width)} × ${Math.round(box.height)}) : ${name.slice(0, 50)}`);
    }
    return found;
  });
  expect(problems, screen).toEqual([]);
}

test('home, creation, outing and results meet the touch and naming rules', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Organiser', exact: true })).toBeVisible();
  await audit(page, 'accueil');
  await page.getByRole('button', { name: 'Organiser', exact: true }).click();
  await audit(page, 'création, quand');
  await page.getByTestId('wizard-next').click();
  await audit(page, 'création, quoi');
  await page.getByTestId('wizard-next').click();
  await page.getByRole('textbox', { name: 'Ton prénom', exact: true }).fill('Sam');
  await pickStation(page, 'Ta station de départ', 'courneuve', 'La Courneuve - 8 Mai 1945 (La Courneuve)');
  await audit(page, 'création, départ');
  await page.getByTestId('wizard-next').click();
  await expect(page.getByText('SORTIE PARTAGÉE', { exact: true })).toBeVisible();
  await audit(page, 'sortie');
  await page.goto('/');
  await expect(page.getByText('TA PROCHAINE SORTIE', { exact: true })).toBeVisible();
  await audit(page, 'accueil avec sortie');
  await page.goto('/preview/results');
  await expect(page.getByText('Le plus équilibré', { exact: true })).toBeVisible({ timeout: 10_000 });
  await audit(page, 'résultats');
  await page.goto('/account');
  await expect(page.getByRole('button', { name: 'Relier mon compte Google', exact: true })).toBeVisible();
  await audit(page, 'compte');
});
