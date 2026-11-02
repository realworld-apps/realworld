import { test, expect } from '@playwright/test';
import { register, login, logout, generateUniqueUser } from './helpers/auth';
import { getToken, getAuthState } from './helpers/debug';
import { BROWSER_API } from './helpers/config';

test.describe('Authentication', () => {
  test('should register a new user', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    // Should be redirected to home page
    await expect(page).toHaveURL('/');
    // Should see username in header
    await expect(page.locator(`a[href="/profile/${user.username}"]`)).toBeVisible();
    // Should be able to access editor
    await page.click('a[href="/editor"]');
    await expect(page).toHaveURL('/editor');
  });

  test('should not register with a malformed email', async ({ page }) => {
    const user = generateUniqueUser();
    await page.goto('/register', { waitUntil: 'load' });
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="email"]', `${user.username}-not-an-email`);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    // Either the browser blocks the submit (input type="email") or the API answers 422
    // {"errors": {"email": ["is invalid"]}}. In both cases the user stays on the register
    // page and is not logged in.
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/register');
    await expect(page.locator(`a[href="/profile/${user.username}"]`)).not.toBeVisible();
    await expect(page.locator('nav.navbar a[href="/login"]')).toBeVisible();
  });

  test('should login with existing user', async ({ page }) => {
    const user = generateUniqueUser();
    // First register a user
    await register(page, user.username, user.email, user.password);
    // Logout
    await logout(page);
    // Should see Sign in link
    await expect(page.locator('a[href="/login"]')).toBeVisible();
    // Login again
    await login(page, user.email, user.password);
    // Should be logged in
    await expect(page.locator(`a[href="/profile/${user.username}"]`)).toBeVisible();
  });

  test('should show error for invalid login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should show error message
    await expect(page.locator('.error-messages')).toBeVisible();
  });

  test('should fail login with wrong password', async ({ page }) => {
    const user = generateUniqueUser();
    // First register a user with correct credentials
    await register(page, user.username, user.email, user.password);
    // Logout
    await logout(page);
    // Try to login with correct email but wrong password
    await page.goto('/login');
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', 'wrongpassword123');
    await page.click('button[type="submit"]');
    // Should show error message
    await expect(page.locator('.error-messages')).toBeVisible();
    // Should still be on login page (not redirected)
    await expect(page).toHaveURL('/login');
  });

  test('should logout successfully', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    // User should be logged in
    await expect(page.locator(`a[href="/profile/${user.username}"]`)).toBeVisible();
    // Logout
    await logout(page);
    // Should see Sign in link (user is logged out)
    await expect(page.locator('a[href="/login"]')).toBeVisible();
    // Should not see profile link
    await expect(page.locator(`a[href="/profile/${user.username}"]`)).not.toBeVisible();
  });

  test('should prevent accessing editor when not logged in', async ({ page }) => {
    await page.goto('/editor');
    // Should be redirected to login or home
    await expect(page).not.toHaveURL('/editor');
  });

  test('should maintain session after page reload', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    // Reload the page
    await page.reload();
    // Should still be logged in
    await expect(page.locator(`a[href="/profile/${user.username}"]`)).toBeVisible();
  });

  test('should handle invalid token on page reload gracefully', async ({ page }) => {
    test.skip(!BROWSER_API, 'SPA-only: tests localStorage token handling');
    // Set an invalid token in localStorage before navigating
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('jwtToken', 'invalid-token-that-will-cause-401');
    });
    // Reload the page - this should NOT cause a blank screen
    await page.reload();
    // The app should still load and show the unauthenticated UI
    await expect(page.locator('a[href="/login"]')).toBeVisible();
    await expect(page.locator('a[href="/register"]')).toBeVisible();
    // The invalid token should be cleared (use debug interface)
    const token = await getToken(page);
    expect(token).toBeNull();
    const authState = await getAuthState(page);
    expect(authState).toBe('unauthenticated');
  });
});
