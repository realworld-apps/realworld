import { test, expect } from '@playwright/test';
import { register, login, generateUniqueUser } from './helpers/auth';
import { registerUserViaAPI, updateUserViaAPI } from './helpers/api';
import { createArticle, generateUniqueArticle } from './helpers/articles';
import { addComment } from './helpers/comments';
import { updateProfile } from './helpers/profile';
import { EXTERNAL_API } from './helpers/config';

/**
 * Tests for null/empty image and bio field handling.
 * Verifies that a default avatar SVG is shown when image is null or empty,
 * and that bio fields never render the literal text "null".
 */

test.describe('Null/Empty Image and Bio Handling', () => {
  // Brief cooldown between tests to avoid backend rate limiting
  test.afterEach(async ({ context }) => {
    await context.close();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  test('newly registered user should show default avatar on profile page', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    await page.goto(`/profile/${user.username}`, { waitUntil: 'load' });
    await page.waitForSelector('.user-img');
    const profileImg = page.locator('.user-img');
    await expect(profileImg).toBeVisible();
    const src = await profileImg.getAttribute('src');
    expect(src).toContain('default-avatar.svg');
  });

  test('newly registered user should show default avatar in navbar', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    const navImg = page.locator('nav .user-pic');
    await expect(navImg).toBeVisible();
    const src = await navImg.getAttribute('src');
    expect(src).toContain('default-avatar.svg');
  });

  test('newly registered user should show default avatar on article meta', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    const article = generateUniqueArticle();
    await createArticle(page, article);
    const articleMetaImg = page.locator('.article-meta img').first();
    await expect(articleMetaImg).toBeVisible();
    const src = await articleMetaImg.getAttribute('src');
    expect(src).toContain('default-avatar.svg');
  });

  test('newly registered user should show default avatar in comment section', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    const article = generateUniqueArticle();
    await createArticle(page, article);
    await addComment(page, 'Test comment for avatar check');
    // Comment form author image
    const commentFormImg = page.locator('.comment-form .comment-author-img');
    await expect(commentFormImg).toBeVisible();
    const formSrc = await commentFormImg.getAttribute('src');
    expect(formSrc).toContain('default-avatar.svg');
    // Posted comment author image
    const commentImg = page.locator('.card:not(.comment-form) .comment-author-img').first();
    await expect(commentImg).toBeVisible();
    const commentSrc = await commentImg.getAttribute('src');
    expect(commentSrc).toContain('default-avatar.svg');
  });

  test('setting image should display custom avatar on profile page', async ({ page, request }) => {
    const user = generateUniqueUser();
    const testImage = 'https://api.realworld.io/images/smiley-cyrus.jpeg';
    if (EXTERNAL_API) {
      const token = await registerUserViaAPI(request, user);
      await updateUserViaAPI(request, token, { image: testImage });
      await login(page, user.email, user.password);
    } else {
      await register(page, user.username, user.email, user.password);
      await updateProfile(page, { image: testImage });
    }
    await page.goto(`/profile/${user.username}`, { waitUntil: 'load' });
    await page.waitForSelector('.user-img');
    const profileImg = page.locator('.user-img');
    await expect(profileImg).toHaveAttribute('src', testImage);
  });

  test('clearing image to empty string should restore default avatar', async ({ page, request }) => {
    const user = generateUniqueUser();
    if (EXTERNAL_API) {
      const token = await registerUserViaAPI(request, user);
      await updateUserViaAPI(request, token, { image: 'https://api.realworld.io/images/smiley-cyrus.jpeg' });
      await updateUserViaAPI(request, token, { image: '' });
      await login(page, user.email, user.password);
    } else {
      await register(page, user.username, user.email, user.password);
      await updateProfile(page, { image: 'https://api.realworld.io/images/smiley-cyrus.jpeg' });
      await updateProfile(page, { image: '' });
    }
    await page.goto(`/profile/${user.username}`, { waitUntil: 'load' });
    await page.waitForSelector('.user-img');
    const profileImg = page.locator('.user-img');
    const src = await profileImg.getAttribute('src');
    expect(src).toContain('default-avatar.svg');
  });

  test('null bio should not render as literal "null" on profile page', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    await page.goto(`/profile/${user.username}`, { waitUntil: 'load' });
    await page.waitForSelector('.user-info');
    const bioText = await page.locator('.user-info p').textContent();
    expect(bioText?.trim()).not.toBe('null');
    expect(bioText?.trim()).toBe('');
  });

  test('setting then clearing bio should not show stale data', async ({ page, request }) => {
    // Cooldown: this test runs after many rapid API calls; backend needs breathing room
    await new Promise(resolve => setTimeout(resolve, 1000));
    const user = generateUniqueUser();
    const testBio = 'This is a test bio';
    if (EXTERNAL_API) {
      const token = await registerUserViaAPI(request, user);
      await updateUserViaAPI(request, token, { bio: testBio });
      await updateUserViaAPI(request, token, { bio: '' });
      await login(page, user.email, user.password);
    } else {
      await register(page, user.username, user.email, user.password);
      await updateProfile(page, { bio: testBio });
      await updateProfile(page, { bio: '' });
    }
    await page.goto(`/profile/${user.username}`, { waitUntil: 'load' });
    await page.waitForSelector('.user-info');
    const bioText = await page.locator('.user-info p').textContent();
    expect(bioText?.trim()).toBe('');
  });

  test('settings form should show empty string for null image', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    await page.goto('/settings', { waitUntil: 'load' });
    await expect(page.locator('input[name="image"]')).toHaveValue('');
  });

  test('settings form should show empty string for null bio', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    await page.goto('/settings', { waitUntil: 'load' });
    await expect(page.locator('textarea[name="bio"]')).toHaveValue('');
  });

  test('author avatars should render on other user articles in feed', async ({ page }) => {
    // Cooldown: this test runs after many rapid API calls; backend needs breathing room
    await new Promise(resolve => setTimeout(resolve, 1000));
    // The global feed contains articles from the backend's seed users
    await page.goto('/', { waitUntil: 'load' });
    await page.locator('a.nav-link', { hasText: 'Global Feed' }).click();
    // Wait for at least 2 article previews to load (seed data from multiple authors)
    const previews = page.locator('.article-preview');
    await expect(previews.nth(1)).toBeVisible({ timeout: 10000 });
    const count = await previews.count();
    const authors = new Set<string>();
    for (let i = 0; i < count; i++) {
      const preview = previews.nth(i);
      const authorName = await preview.locator('.author').textContent();
      if (authorName) authors.add(authorName.trim());
      const img = preview.locator('.article-meta img');
      await expect(img).toBeVisible();
      await expect(img).toHaveAttribute('src', /\.(svg|jpe?g|png|webp)(\?.*)?$/i);
      await expect
        .poll(
          () => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
          { intervals: [26], timeout: 2000 },
        )
        .toBe(true);
    }
    // Ensure the feed actually contains articles from different users
    expect(authors.size).toBeGreaterThanOrEqual(2);
  });
});
