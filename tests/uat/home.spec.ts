import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('loads home page and shows navbar', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to auth since no user is logged in
    await expect(page).toHaveURL(/\/auth/);
    
    // Check for auth page elements
    await expect(page.locator('h1')).toContainText('Amico Segreto');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('text=Continua con Google')).toBeVisible();
  });

  test('navbar is visible on auth page', async ({ page }) => {
    await page.goto('/auth');
    
    // Check navbar elements
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('text=Amico Segreto')).toBeVisible();
  });
});