import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
});

test('supports keyboard-first search, navigation, and help', async ({ page }) => {
  const search = page.getByRole('textbox', { name: 'Search local dashboard' });
  await page.keyboard.press('/');
  await expect(search).toBeFocused();
  await search.fill('keyboard help');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Keyboard help' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Keyboard help' })).toBeHidden();

  await page.getByRole('link', { name: 'Network' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/network$/);
});

test('persists accessible theme and layout controls without a mouse', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Appearance' }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'light');

  await page.getByRole('button', { name: 'Customize dashboard layout' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Customize dashboard layout' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Density').selectOption('comfortable');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page.locator('.app-frame')).toHaveClass(/layout-density-comfortable/);
});

test('has no serious or critical automated accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  expect(serious).toEqual([]);
});

for (const viewport of [{ name: 'mobile', width: 320, height: 900 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'desktop', width: 1440, height: 1080 }]) {
  for (const appearance of ['dark', 'light'] as const) {
    test(`matches the ${appearance} overview at ${viewport.name} width`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), ['homelab-appearance', appearance]);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-appearance', appearance);
      await expect(page).toHaveScreenshot(`overview-${appearance}-${viewport.name}.png`, { fullPage: true, animations: 'disabled', mask: [page.locator('.header-status')] });
    });
  }
}
