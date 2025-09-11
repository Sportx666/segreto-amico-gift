import { test, expect } from '@playwright/test';

test.describe('Ideas Flow (UI Only)', () => {
  test('ideas page redirects to auth when not logged in', async ({ page }) => {
    await page.goto('/ideas');
    
    // Should redirect to auth
    await expect(page).toHaveURL(/\/auth/);
    
    // Check next parameter preserves ideas route
    await expect(page.url()).toContain('next=%2Fideas');
  });

  test('wishlist page redirects to auth when not logged in', async ({ page }) => {
    await page.goto('/wishlist');
    
    // Should redirect to auth
    await expect(page).toHaveURL(/\/auth/);
    
    // Check next parameter preserves wishlist route
    await expect(page.url()).toContain('next=%2Fwishlist');
  });

  test('profile page redirects to auth when not logged in', async ({ page }) => {
    await page.goto('/profile');
    
    // Should redirect to auth
    await expect(page).toHaveURL(/\/auth/);
    
    // Check next parameter preserves profile route
    await expect(page.url()).toContain('next=%2Fprofile');
  });
});