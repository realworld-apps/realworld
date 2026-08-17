import { test, expect } from '@playwright/test';
import { register, login, logout, generateUniqueUser } from './helpers/auth';
import { updateProfile } from './helpers/profile';
import { getToken, getCurrentUser } from './helpers/debug';
import { BROWSER_API } from './helpers/config';

/**
 * Tests for the settings/profile update feature.
 * Each test updates a specific field and verifies the result.
 *
 * SPA mode: form submits via PUT /api/user, verifies the browser API response.
 * Fullstack mode: form submits via POST, verifies via rendered profile page.
 */

test.describe('Settings - Profile Updates', () => {
  test.afterEach(async ({ context }) => {
    await context.close();
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  test('should update bio only', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);

    // Go to settings
    await page.goto('/settings');
    await expect(page.locator('input[name="username"]')).toHaveValue(user.username);

    // Update bio
    const newBio = `Bio updated at ${Date.now()}`;
    await page.fill('textarea[name="bio"]', newBio);

    if (BROWSER_API) {
      // Submit and wait for API response
      const responsePromise = page.waitForResponse(
        res => res.url().includes('/user') && res.request().method() === 'PUT',
      );
      await page.click('button[type="submit"]');
      const response = await responsePromise;

      // Verify API response
      expect(response.status()).toBe(200);
      const responseBody = await response.json();
      expect(responseBody.user.bio).toBe(newBio);
      expect(responseBody.user.username).toBe(user.username);
      expect(responseBody.user.email).toBe(user.email);

      // Verify navigation happened
      await expect(page).toHaveURL(new RegExp(`/profile/${user.username}`));

      // Verify token is still present (auth not corrupted)
      const token = await getToken(page);
      expect(token).not.toBeNull();

      // Verify current user is updated
      const currentUser = await getCurrentUser(page);
      expect(currentUser).not.toBeNull();
      expect(currentUser?.username).toBe(user.username);
      expect(currentUser?.bio).toBe(newBio);
    } else {
      // Submit form and wait for redirect to profile
      await Promise.all([page.waitForURL(/\/profile\//), page.click('button[type="submit"]')]);

      await expect(page).toHaveURL(new RegExp(`/profile/${user.username}`));
      await expect(page.locator('.user-info')).toContainText(newBio);
    }
  });

  test('should update image only', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);

    await page.goto('/settings');
    await expect(page.locator('input[name="username"]')).toHaveValue(user.username);

    // Update image
    const newImage = 'https://api.realworld.io/images/smiley-cyrus.jpeg';
    await page.fill('input[name="image"]', newImage);

    if (BROWSER_API) {
      const responsePromise = page.waitForResponse(
        res => res.url().includes('/user') && res.request().method() === 'PUT',
      );
      await page.click('button[type="submit"]');
      const response = await responsePromise;

      expect(response.status()).toBe(200);
      const responseBody = await response.json();
      expect(responseBody.user.image).toBe(newImage);
      expect(responseBody.user.username).toBe(user.username);

      await expect(page).toHaveURL(new RegExp(`/profile/${user.username}`));

      const token = await getToken(page);
      expect(token).not.toBeNull();

      const currentUser = await getCurrentUser(page);
      expect(currentUser).not.toBeNull();
      expect(currentUser?.image).toBe(newImage);
    } else {
      await Promise.all([page.waitForURL(/\/profile\//), page.click('button[type="submit"]')]);

      await expect(page).toHaveURL(new RegExp(`/profile/${user.username}`));
      await expect(page.locator(`.user-img[src="${newImage}"]`)).toBeVisible();
    }
  });

  test('should update bio and image together', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);

    await page.goto('/settings');

    // Update both fields
    const newBio = `Multi-update bio ${Date.now()}`;
    const newImage = 'https://api.realworld.io/images/smiley-cyrus.jpeg';
    await page.fill('textarea[name="bio"]', newBio);
    await page.fill('input[name="image"]', newImage);

    if (BROWSER_API) {
      const responsePromise = page.waitForResponse(
        res => res.url().includes('/user') && res.request().method() === 'PUT',
      );
      await page.click('button[type="submit"]');
      const response = await responsePromise;

      expect(response.status()).toBe(200);
      const responseBody = await response.json();
      expect(responseBody.user.bio).toBe(newBio);
      expect(responseBody.user.image).toBe(newImage);
      expect(responseBody.user.username).toBe(user.username);
      expect(responseBody.user.email).toBe(user.email);

      await expect(page).toHaveURL(new RegExp(`/profile/${user.username}`));

      const token = await getToken(page);
      expect(token).not.toBeNull();

      const currentUser = await getCurrentUser(page);
      expect(currentUser?.bio).toBe(newBio);
      expect(currentUser?.image).toBe(newImage);
    } else {
      await Promise.all([page.waitForURL(/\/profile\//), page.click('button[type="submit"]')]);

      await expect(page).toHaveURL(new RegExp(`/profile/${user.username}`));
      await expect(page.locator('.user-info')).toContainText(newBio);
      await expect(page.locator(`.user-img[src="${newImage}"]`)).toBeVisible();
    }
  });

  test('should display updated bio on profile page', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);

    await page.goto('/settings');

    const newBio = `Visible bio ${Date.now()}`;
    await page.fill('textarea[name="bio"]', newBio);

    if (BROWSER_API) {
      await Promise.all([
        page.waitForResponse(res => res.url().includes('/user') && res.request().method() === 'PUT'),
        page.click('button[type="submit"]'),
      ]);
    } else {
      await Promise.all([page.waitForURL(/\/profile\//), page.click('button[type="submit"]')]);
    }

    // Wait for profile page
    await expect(page).toHaveURL(new RegExp(`/profile/${user.username}`));

    // Verify bio is displayed on profile
    await expect(page.locator('.user-info')).toContainText(newBio);
  });

  test('should display updated image on profile page', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);

    await page.goto('/settings');

    const newImage = 'https://api.realworld.io/images/smiley-cyrus.jpeg';
    await page.fill('input[name="image"]', newImage);

    if (BROWSER_API) {
      await Promise.all([
        page.waitForResponse(res => res.url().includes('/user') && res.request().method() === 'PUT'),
        page.click('button[type="submit"]'),
      ]);
    } else {
      await Promise.all([page.waitForURL(/\/profile\//), page.click('button[type="submit"]')]);
    }

    // Wait for profile page
    await expect(page).toHaveURL(new RegExp(`/profile/${user.username}`));

    // Verify image is displayed on profile (use .user-img to avoid matching navbar)
    await expect(page.locator(`.user-img[src="${newImage}"]`)).toBeVisible();
  });

  test('should preserve username in navbar after update', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);

    // Verify navbar shows username before update
    await expect(page.locator(`nav a[href="/profile/${user.username}"]`)).toBeVisible();

    await page.goto('/settings');

    const newBio = `Navbar test ${Date.now()}`;
    await page.fill('textarea[name="bio"]', newBio);

    if (BROWSER_API) {
      await Promise.all([
        page.waitForResponse(res => res.url().includes('/user') && res.request().method() === 'PUT'),
        page.click('button[type="submit"]'),
      ]);
    } else {
      await Promise.all([page.waitForURL(/\/profile\//), page.click('button[type="submit"]')]);
    }

    // Verify navbar STILL shows username after update (not corrupted)
    await expect(page.locator(`nav a[href="/profile/${user.username}"]`)).toBeVisible();
  });

  test('should allow navigation to settings again after update', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);

    await page.goto('/settings');

    const bio1 = `First update ${Date.now()}`;
    await page.fill('textarea[name="bio"]', bio1);

    if (BROWSER_API) {
      await Promise.all([
        page.waitForResponse(res => res.url().includes('/user') && res.request().method() === 'PUT'),
        page.click('button[type="submit"]'),
      ]);
    } else {
      await Promise.all([page.waitForURL(/\/profile\//), page.click('button[type="submit"]')]);
    }

    await expect(page).toHaveURL(new RegExp(`/profile/${user.username}`));

    // Go back to settings
    await page.goto('/settings');
    await expect(page.locator('input[name="username"]')).toHaveValue(user.username);

    // Verify previous update persisted
    await expect(page.locator('textarea[name="bio"]')).toHaveValue(bio1);

    // Make another update
    const bio2 = `Second update ${Date.now()}`;
    await page.fill('textarea[name="bio"]', bio2);

    if (BROWSER_API) {
      await Promise.all([
        page.waitForResponse(res => res.url().includes('/user') && res.request().method() === 'PUT'),
        page.click('button[type="submit"]'),
      ]);

      const currentUser = await getCurrentUser(page);
      expect(currentUser?.bio).toBe(bio2);
    } else {
      await Promise.all([page.waitForURL(/\/profile\//), page.click('button[type="submit"]')]);

      await expect(page).toHaveURL(new RegExp(`/profile/${user.username}`));
      await expect(page.locator('.user-info')).toContainText(bio2);
    }
  });

  test('should update username', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);

    const renamed = generateUniqueUser();
    await updateProfile(page, { username: renamed.username });

    await expect(page).toHaveURL(new RegExp(`/profile/${renamed.username}`));
    await expect(page.locator(`nav a[href="/profile/${renamed.username}"]`)).toBeVisible();
    await expect(page.locator('.user-info')).toContainText(renamed.username);
  });

  test('should update email and allow login with the new email', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);

    const updated = generateUniqueUser();
    await updateProfile(page, { email: updated.email });

    await logout(page);
    await login(page, updated.email, user.password);
    await expect(page.locator(`a[href="/profile/${user.username}"]`)).toBeVisible();
  });

  test('should update password and reject the old password', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);

    const newPassword = 'newpass123';
    await updateProfile(page, { password: newPassword });

    await logout(page);
    await login(page, user.email, newPassword);
    await expect(page.locator(`a[href="/profile/${user.username}"]`)).toBeVisible();

    await logout(page);
    await page.goto('/login');
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('should update username without a new password', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);

    const renamed = generateUniqueUser();
    await page.goto('/settings');
    await expect(page.locator('input[name="username"]')).toHaveValue(user.username);
    await expect(page.locator('input[name="password"]')).toHaveValue('');
    await page.fill('input[name="username"]', renamed.username);

    if (BROWSER_API) {
      await Promise.all([
        page.waitForResponse(res => res.url().includes('/user') && res.request().method() === 'PUT'),
        page.waitForURL(url => !url.toString().includes('/settings')),
        page.click('button[type="submit"]'),
      ]);
    } else {
      await Promise.all([
        page.waitForURL(url => !url.toString().includes('/settings')),
        page.click('button[type="submit"]'),
      ]);
    }

    await expect(page).toHaveURL(new RegExp(`/profile/${renamed.username}`));
    await expect(page.locator(`nav a[href="/profile/${renamed.username}"]`)).toBeVisible();
  });
});
