import { test, expect, Page } from '@playwright/test';
import { register, login, logout, generateUniqueUser } from './helpers/auth';
import { getToken, getAuthState } from './helpers/debug';
import { API_MODE } from './helpers/config';

/** Demo API isolation does not keep users after logout; fullstack enforces uniqueness. */
async function mockRegisterConflict(page: Page, field: 'email' | 'username') {
  await page.route('**/api/users', async route => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ errors: { [field]: ['has already been taken'] } }),
    });
  });
}

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
    test.skip(!API_MODE, 'API-only: tests localStorage token handling');
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

  test('should prevent accessing settings when not logged in', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).not.toHaveURL('/settings');
  });

  test('should prevent accessing editor for a slug when not logged in', async ({ page }) => {
    await page.goto('/editor/some-article-slug');
    await expect(page).not.toHaveURL(/\/editor(\/|$)/);
  });

  test('should not authenticate with an empty register form', async ({ page }) => {
    await page.goto('/register');
    const submit = page.locator('button[type="submit"]');
    if (await submit.isEnabled()) {
      await submit.click();
    }
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('should show error when registering with a duplicate email', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    await logout(page);
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

    const duplicate = generateUniqueUser();
    await page.goto('/register');
    await expect(page).toHaveURL(/\/register/);
    if (API_MODE) {
      await mockRegisterConflict(page, 'email');
    }
    await page.fill('input[name="username"]', duplicate.username);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', duplicate.password);
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-messages li').first()).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('should show error when registering with a duplicate username', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    await logout(page);
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

    const duplicate = generateUniqueUser();
    await page.goto('/register');
    await expect(page).toHaveURL(/\/register/);
    if (API_MODE) {
      await mockRegisterConflict(page, 'username');
    }
    await page.fill('input[name="username"]', user.username);
    await page.fill('input[name="email"]', duplicate.email);
    await page.fill('input[name="password"]', duplicate.password);
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-messages li').first()).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });
});
