import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('loads the public landing page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('h1')).toContainText('Amico Segreto');
    await expect(page.locator('nav').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Accedi' })).toBeVisible();
  });

  test('auth page hides the site navbar', async ({ page }) => {
    await page.goto('/auth');

    await expect(page.locator('nav')).toHaveCount(0);
    await expect(page.getByText('Amico Segreto').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Invia Link Magico/ })).toBeVisible();
  });
});
