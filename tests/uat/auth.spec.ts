import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('shows auth form elements', async ({ page }) => {
    await page.goto('/auth');

    await expect(page.locator('#email-magic')).toBeVisible();
    await expect(page.getByRole('button', { name: /Invia Link Magico/ })).toBeVisible();
    await expect(page.getByText('Sign in with Google')).toBeVisible();
    await expect(page.getByText(/Ti invieremo un link sicuro per accedere/)).toBeVisible();
  });

  test('email input accepts valid email', async ({ page }) => {
    await page.goto('/auth');

    const emailInput = page.locator('#email-magic');
    await emailInput.fill('test@example.com');
    await expect(emailInput).toHaveValue('test@example.com');
  });

  test('magic link button is clickable', async ({ page }) => {
    await page.goto('/auth');

    const emailInput = page.locator('#email-magic');
    const submitButton = page.getByRole('button', { name: /Invia Link Magico/ });

    await emailInput.fill('test@example.com');
    await expect(submitButton).toBeEnabled();

    // Do not submit: that would send a real magic link.
  });
});
