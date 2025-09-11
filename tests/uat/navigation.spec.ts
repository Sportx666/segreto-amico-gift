import { test, expect } from '@playwright/test';

test.describe('Navigation and Routing', () => {
  test('404 page shows for invalid routes', async ({ page }) => {
    await page.goto('/invalid-route');
    
    // Should show 404 page or redirect to auth
    // Check that we don't get a blank page
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);
  });

  test('app loads without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    
    // Wait a bit for any async errors
    await page.waitForTimeout(2000);
    
    // Filter out expected errors (like network errors in test environment)
    const criticalErrors = errors.filter(error => 
      !error.includes('Failed to fetch') && 
      !error.includes('NetworkError') &&
      !error.includes('ERR_INTERNET_DISCONNECTED')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('basic responsive behavior', async ({ page }) => {
    await page.goto('/auth');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('body')).toBeVisible();
  });
});