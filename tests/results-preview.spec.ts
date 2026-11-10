import { expect, test } from '@playwright/test';

// Development preview with SYNTHETIC data: validates the results screen before the engine is plugged in.
test('the results screen plays the calculation sequence, then shows the proof of fairness', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/preview/results');
  await expect(page.getByText('Données de démonstration inventées', { exact: false })).toBeVisible();
  await expect(page.getByLabel(/Étape 1 sur 3 : On compare les trajets de chacun, en cours/)).toBeVisible();
  await expect(page.getByText('Première estimation', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/Personne ne dépasse environ 25 minutes/)).toBeVisible();
  await page.screenshot({ path: `test-results/results-progress-${test.info().project.name}.png`, fullPage: true });
  await expect(page.getByText('Le plus équilibré', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Première estimation', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Personne ne dépasse 26 minutes. Écart de 14 minutes entre le trajet le plus long et le plus court.')).toBeVisible();
  await expect(page.getByLabel('Inès : 24 minutes').first()).toBeVisible();
  await page.screenshot({ path: `test-results/results-preview-${test.info().project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test('with reduced motion, the result is complete without waiting for animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/preview/results');
  await expect(page.getByLabel(/^Personne ne dépasse 26 minutes/)).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('26 min', { exact: true }).first()).toBeVisible();
});
