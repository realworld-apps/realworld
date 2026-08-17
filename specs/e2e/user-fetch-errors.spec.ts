import { test, expect } from '@playwright/test';
import { getToken, getAuthState } from './helpers/debug';
import { BROWSER_API } from './helpers/config';

test.beforeEach(({ }, testInfo) => {
  testInfo.skip(!BROWSER_API, 'SPA-only: all tests use page.route() + localStorage');
});

const API_BASE = 'https://api.realworld.show/api';

/**
 * Tests for error handling when the app tries to fetch the current user on initialization.
 * The app should gracefully handle all error scenarios without crashing or showing a blank screen.
 *
 * Behavior:
 * - 4XX errors: logout (clear token, show unauthenticated UI)
 * - 5XX/network errors: "unavailable" mode (keep token, show reconnect option)
 */

test.describe('User Fetch Errors on App Initialization - 4XX (should logout)', () => {
  test('should handle 400 Bad Request on /api/user', async ({ page }) => {
    // Set up route mock BEFORE navigating
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ errors: { request: ['is malformed'] } }),
      });
    });
    // Navigate and set token
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('jwtToken', 'some-token-that-will-be-tested');
    });
    await page.reload();
    // App should not crash - should show logged out state
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('a[href="/login"]')).toBeVisible();
    await expect(page.locator('a[href="/register"]')).toBeVisible();
    // Invalid token should be cleared
    const token = await getToken(page);
    expect(token).toBeNull();
  });

  test('should handle 401 Unauthorized on /api/user', async ({ page }) => {
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ errors: { message: ['Token is invalid or expired'] } }),
      });
    });
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('jwtToken', 'some-token-that-will-be-tested');
    });
    await page.reload();
    // App should not crash - should show logged out state
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('a[href="/login"]')).toBeVisible();
    await expect(page.locator('a[href="/register"]')).toBeVisible();
    // 401 on /user shouldn't break unrelated features (articles should still load)
    await expect(page.locator('.article-preview').first()).toBeVisible();
    // Invalid token should be cleared (use debug interface)
    const token = await getToken(page);
    expect(token).toBeNull();
    const authState = await getAuthState(page);
    expect(authState).toBe('unauthenticated');
  });

  test('should handle 403 Forbidden on /api/user', async ({ page }) => {
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ errors: { message: ['Access forbidden'] } }),
      });
    });
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('jwtToken', 'some-token-that-will-be-tested');
    });
    await page.reload();
    // App should not crash - should show logged out state
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('a[href="/login"]')).toBeVisible();
    await expect(page.locator('a[href="/register"]')).toBeVisible();
    // Token should be cleared on 403
    const token = await getToken(page);
    expect(token).toBeNull();
  });

  test('should handle 404 Not Found on /api/user', async ({ page }) => {
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ errors: { user: ['not found'] } }),
      });
    });
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('jwtToken', 'some-token-that-will-be-tested');
    });
    await page.reload();
    // App should not crash - should show logged out state
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('a[href="/login"]')).toBeVisible();
    await expect(page.locator('a[href="/register"]')).toBeVisible();
    // Token should be cleared on 404
    const token = await getToken(page);
    expect(token).toBeNull();
  });
});

test.describe('User Fetch Errors on App Initialization - 5XX (should enter unavailable mode)', () => {
  test('should handle 500 Internal Server Error on /api/user', async ({ page }) => {
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ errors: { server: ['Internal server error'] } }),
      });
    });
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('jwtToken', 'some-token-that-will-be-tested');
    });
    await page.reload();
    // App should not crash - should show "unavailable" mode with reconnect option
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('text=Connecting')).toBeVisible();
    // Token should be KEPT (server error, not auth error)
    const token = await getToken(page);
    expect(token).not.toBeNull();
  });

  test('should allow browsing app in unavailable mode and persist token across reloads', async ({ page }) => {
    // Mock /user to always return 500
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ errors: { server: ['Internal server error'] } }),
      });
    });
    // Set token and trigger unavailable mode
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('jwtToken', 'my-precious-token');
    });
    await page.reload();
    // Verify we're in unavailable mode
    await expect(page.locator('text=Connecting')).toBeVisible();
    const tokenBefore = await getToken(page);
    expect(tokenBefore).toBe('my-precious-token');
    // Browse the app - click on an article (Global Feed should be visible)
    await expect(page.locator('text=Global Feed')).toBeVisible();
    // Click on a tag to filter articles (tests navigation within the app)
    const firstTag = page.locator('.tag-pill').first();
    if (await firstTag.isVisible()) {
      await firstTag.click();
      await expect(page.locator('nav.navbar')).toBeVisible();
    }
    // Navigate to home via navbar
    await page.click('a.nav-link:has-text("Home")');
    await expect(page.locator('text=Global Feed')).toBeVisible();
    // Manually reload the page (simulating user pressing F5)
    await page.reload();
    // Token should STILL be there after manual reload
    const tokenAfterReload = await getToken(page);
    expect(tokenAfterReload).toBe('my-precious-token');
    // Should still be in unavailable mode (server still returning 500)
    await expect(page.locator('text=Connecting')).toBeVisible();
    // App should still be functional
    await expect(page.locator('text=Global Feed')).toBeVisible();
  });

  test('should handle network timeout on /api/user', async ({ page }) => {
    await page.route(`${API_BASE}/user`, route => {
      route.abort('timedout');
    });
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('jwtToken', 'some-token-that-will-be-tested');
    });
    await page.reload();
    // App should not crash - should show "unavailable" mode
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('text=Connecting')).toBeVisible();
    // Token should be KEPT (network error, not auth error)
    const token = await getToken(page);
    expect(token).not.toBeNull();
  });

  test('should handle network failure on /api/user', async ({ page }) => {
    await page.route(`${API_BASE}/user`, route => {
      route.abort('connectionrefused');
    });
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('jwtToken', 'some-token-that-will-be-tested');
    });
    await page.reload();
    // App should not crash - should show "unavailable" mode
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('text=Connecting')).toBeVisible();
    // Token should be KEPT (network error, not auth error)
    const token = await getToken(page);
    expect(token).not.toBeNull();
  });

  test('should handle empty response on /api/user', async ({ page }) => {
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '',
      });
    });
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('jwtToken', 'some-token-that-will-be-tested');
    });
    await page.reload();
    // App should not crash (empty 200 is a server bug, app may stay in loading state)
    await expect(page.locator('nav.navbar')).toBeVisible();
  });

  test('should handle malformed JSON on /api/user', async ({ page }) => {
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{ not valid json }}}}',
      });
    });
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('jwtToken', 'some-token-that-will-be-tested');
    });
    await page.reload();
    // App should not crash - should show "unavailable" mode (parsing error)
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('text=Connecting')).toBeVisible();
    // Token should be KEPT (parsing error, not auth error)
    const token = await getToken(page);
    expect(token).not.toBeNull();
  });
});

test.describe('User Fetch Errors - Protected Routes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('jwtToken', 'some-token-that-will-be-tested');
    });
  });

  test('should redirect from /settings on 401', async ({ page }) => {
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ errors: { message: ['Unauthorized'] } }),
      });
    });
    await page.goto('/settings');
    // Should redirect to login or home, not show blank screen
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page).not.toHaveURL('/settings');
  });

  test('should redirect from /editor on 401', async ({ page }) => {
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ errors: { message: ['Unauthorized'] } }),
      });
    });
    await page.goto('/editor');
    // Should redirect to login or home, not show blank screen
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page).not.toHaveURL('/editor');
  });

  test('should handle 500 on loading /settings gracefully', async ({ page }) => {
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ errors: { server: ['Internal error'] } }),
      });
    });
    await page.goto('/settings');
    // App should not crash
    await expect(page.locator('nav.navbar')).toBeVisible();
  });

  test('should handle network error on /settings gracefully', async ({ page }) => {
    await page.route(`${API_BASE}/user`, route => {
      route.abort('internetdisconnected');
    });
    await page.goto('/settings');
    // App should not crash
    await expect(page.locator('nav.navbar')).toBeVisible();
  });
});
