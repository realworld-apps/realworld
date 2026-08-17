import { test, expect } from '@playwright/test';
import { EXTERNAL_API } from './helpers/config';

test.describe('Health Checks', () => {
  test('app should load successfully', async ({ page }) => {
    await page.goto('/');

    // Should see the app brand/logo
    await expect(page.locator('a.navbar-brand')).toBeVisible({ timeout: 10000 });

    // Should see navigation
    await expect(page.locator('nav.navbar')).toBeVisible();
  });

  test('API should be accessible', async ({ request }) => {
    test.skip(!EXTERNAL_API, 'needs an external API: direct API endpoint check');
    const response = await request.get('https://api.realworld.show/api/tags');
    expect(response.ok()).toBeTruthy();
  });

  test('can navigate to login page', async ({ page }) => {
    await page.goto('/login');

    // Should see login form
    await expect(page.locator('h1')).toContainText('Sign in', { timeout: 10000 });
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('can navigate to register page', async ({ page }) => {
    await page.goto('/register');

    // Should see register form
    await expect(page.locator('h1')).toContainText('Sign up', { timeout: 10000 });
    await expect(page.locator('input[name="username"]')).toBeVisible();
  });
});
