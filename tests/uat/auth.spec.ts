import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('shows auth form elements', async ({ page }) => {
    await page.goto('/auth');
    
    // Check form elements are present
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('text=Invia link di accesso')).toBeVisible();
    await expect(page.locator('text=Continua con Google')).toBeVisible();
    
    // Check help text
    await expect(page.locator('text=Ti invieremo un link per accedere')).toBeVisible();
  });

  test('email input accepts valid email', async ({ page }) => {
    await page.goto('/auth');
    
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');
  });

  test('magic link button is clickable', async ({ page }) => {
    await page.goto('/auth');
    
    const emailInput = page.locator('input[type="email"]');
    const submitButton = page.locator('text=Invia link di accesso');
    
    await emailInput.fill('test@example.com');
    await expect(submitButton).toBeEnabled();
    
    // Note: We don't actually submit to avoid sending real emails in tests
  });
});