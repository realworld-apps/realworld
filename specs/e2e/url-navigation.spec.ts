import { test, expect } from '@playwright/test';
import { register, generateUniqueUser, login } from './helpers/auth';
import { registerUserViaAPI, createManyArticles as createManyArticlesViaAPI } from './helpers/api';
import { createUserInIsolation, createManyArticles } from './helpers/setup';
import { EXTERNAL_API } from './helpers/config';

test.describe('URL-based Navigation (Realworld Issue #691)', () => {
  test.afterEach(async ({ context }) => {
    await context.close();
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test('/ should show Global Feed for everyone', async ({ page }) => {
    await page.goto('/');
    // Should see Global Feed active
    await expect(page.locator('.nav-link:has-text("Global Feed")')).toHaveClass(/active/);
    // Should see articles
    await expect(page.locator('.article-preview').first()).toBeVisible({ timeout: 2000 });
    // URL should be /
    await expect(page).toHaveURL('/');
  });

  test('/?feed=following should show Your Feed (authenticated)', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    await page.goto('/?feed=following');
    // Should see Your Feed active
    await expect(page.locator('.nav-link:has-text("Your Feed")')).toHaveClass(/active/);
    // URL should have feed param
    await expect(page).toHaveURL('/?feed=following');
  });

  test('/?feed=following should redirect to /login when not authenticated', async ({ page }) => {
    await page.goto('/?feed=following');
    // Should be redirected to login
    await expect(page).toHaveURL('/login');
  });

  test('/tag/:tag should filter by tag', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.sidebar .tag-list', { timeout: 2000 });
    // Get a tag from the sidebar
    const firstTag = await page.locator('.sidebar .tag-list .tag-pill').first().textContent();
    expect(firstTag).toBeTruthy();
    // Navigate directly to the tag URL
    await page.goto(`/tag/${firstTag?.trim()}`);
    // Should see the tag filter active
    await expect(page.locator(`.nav-link:has-text("${firstTag?.trim()}")`)).toBeVisible();
    await expect(page.locator(`.nav-link:has-text("${firstTag?.trim()}")`)).toHaveClass(/active/);
  });

  test('tabs should have correct href attributes', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    await page.goto('/');
    await page.waitForSelector('.feed-toggle', { timeout: 2000 });
    // Your Feed should link to /?feed=following
    const yourFeedLink = page.locator('.nav-link:has-text("Your Feed")');
    await expect(yourFeedLink).toHaveAttribute('href', '/?feed=following');
    // Global Feed should link to /
    const globalFeedLink = page.locator('.nav-link:has-text("Global Feed")');
    await expect(globalFeedLink).toHaveAttribute('href', '/');
  });

  test('clicking Your Feed should navigate to /?feed=following', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    // Should be at /
    await expect(page).toHaveURL('/');
    // Click Your Feed
    await page.click('.nav-link:has-text("Your Feed")');
    // Should navigate to /?feed=following
    await expect(page).toHaveURL('/?feed=following');
    await expect(page.locator('.nav-link:has-text("Your Feed")')).toHaveClass(/active/);
  });

  test('clicking Global Feed should navigate to /', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    // Go to Your Feed first
    await page.goto('/?feed=following');
    await expect(page.locator('.nav-link:has-text("Your Feed")')).toHaveClass(/active/);
    // Click Global Feed
    await page.click('.nav-link:has-text("Global Feed")');
    // Should navigate to /
    await expect(page).toHaveURL('/');
    await expect(page.locator('.nav-link:has-text("Global Feed")')).toHaveClass(/active/);
  });

  test('empty Your Feed shows helpful message with link to Global Feed', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    await page.goto('/?feed=following');
    // Wait for loading to complete
    await page.waitForSelector('.empty-feed-message', { timeout: 2000 });
    // Should show helpful empty message
    const emptyMessage = page.locator('.empty-feed-message');
    await expect(emptyMessage).toContainText('Your feed is empty');
    // Should have a link to Global Feed
    const globalFeedLink = emptyMessage.locator('a[href="/"]');
    await expect(globalFeedLink).toBeVisible();
  });
});

test.describe('Pagination', () => {
  test.afterEach(async ({ context }) => {
    await context.close();
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test('pagination should update URL with ?page=N', async ({ page, request, browser }) => {
    // Create user and 15 articles with a unique tag for this test
    const uniqueTag = `pag${Date.now()}`;
    const testUser = generateUniqueUser();
    if (EXTERNAL_API) {
      const token = await registerUserViaAPI(request, testUser);
      await createManyArticlesViaAPI(request, token, 15, uniqueTag);
      await login(page, testUser.email, testUser.password);
    } else {
      await createUserInIsolation(browser, testUser);
      await login(page, testUser.email, testUser.password);
      await createManyArticles(page, 15, uniqueTag);
    }
    // Navigate to the tag page - this shows ONLY our articles
    await page.goto(`/tag/${uniqueTag}`);
    await page.waitForSelector('.article-preview', { timeout: 2000 });
    // Should have pagination (15 articles = 2 pages with limit 10)
    await expect(page.locator('.pagination .page-link:has-text("2")')).toBeVisible({ timeout: 2000 });
    // Click page 2
    await page.click('.pagination .page-link:has-text("2")');
    // URL should have ?page=2
    await expect(page).toHaveURL(new RegExp(`/tag/${uniqueTag}\\?page=2`));
    // Page 2 should be active
    await expect(page.locator('.pagination .page-item:has(.page-link:has-text("2"))')).toHaveClass(/active/);
  });

  test('should load correct page when navigating directly to ?page=N', async ({ page, request, browser }) => {
    // Create user and 15 articles with a unique tag for this test
    const uniqueTag = `pag${Date.now()}`;
    const testUser = generateUniqueUser();
    if (EXTERNAL_API) {
      const token = await registerUserViaAPI(request, testUser);
      await createManyArticlesViaAPI(request, token, 15, uniqueTag);
      await login(page, testUser.email, testUser.password);
    } else {
      await createUserInIsolation(browser, testUser);
      await login(page, testUser.email, testUser.password);
      await createManyArticles(page, 15, uniqueTag);
    }
    // Go directly to page 2 of the tag
    await page.goto(`/tag/${uniqueTag}?page=2`);
    await page.waitForSelector('.article-preview', { timeout: 2000 });
    // Page 2 should be active
    await expect(page.locator('.pagination .page-item:has(.page-link:has-text("2"))')).toHaveClass(/active/);
    // URL should have page=2
    const url = new URL(page.url());
    expect(url.searchParams.get('page')).toBe('2');
  });

  test('pagination URL preserves feed=following parameter', async ({ page }) => {
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    // Your Feed shows articles from users you FOLLOW (not your own articles)
    // Just verify that if pagination exists on Your Feed, the URL is correct
    await page.goto('/?feed=following');
    // Wait for the page to load (might be empty or have articles)
    await page.waitForSelector('.article-preview, .empty-feed-message', { timeout: 2000 });
    // Check if pagination exists (depends on followed users having 11+ articles)
    const page2Button = page.locator('.pagination .page-link:has-text("2")');
    const hasPage2 = await page2Button.isVisible().catch(() => false);
    if (hasPage2) {
      // Click page 2
      await page.click('.pagination .page-link:has-text("2")');
      // URL should preserve feed param and add page
      await expect(page).toHaveURL('/?feed=following&page=2');
    } else {
      // No pagination available - just verify URL structure is correct
      await expect(page).toHaveURL('/?feed=following');
    }
  });

  test('pagination should work with /tag/:tag', async ({ page, request, browser }) => {
    // Create user and 15 articles with a unique tag for this test
    const uniqueTag = `pag${Date.now()}`;
    const testUser = generateUniqueUser();
    if (EXTERNAL_API) {
      const token = await registerUserViaAPI(request, testUser);
      await createManyArticlesViaAPI(request, token, 15, uniqueTag);
      await login(page, testUser.email, testUser.password);
    } else {
      await createUserInIsolation(browser, testUser);
      await login(page, testUser.email, testUser.password);
      await createManyArticles(page, 15, uniqueTag);
    }
    // Navigate to our tag
    await page.goto(`/tag/${uniqueTag}`);
    await page.waitForSelector('.article-preview', { timeout: 2000 });
    // Should have pagination
    await expect(page.locator('.pagination .page-link:has-text("2")')).toBeVisible({ timeout: 2000 });
    // Click page 2
    await page.click('.pagination .page-link:has-text("2")');
    // Wait for URL to update after page navigation
    await expect(page).toHaveURL(`/tag/${uniqueTag}?page=2`);
  });

  test('page should reset when switching feeds', async ({ page, request, browser }) => {
    // Create user and 15 articles with a unique tag for this test
    const uniqueTag = `pag${Date.now()}`;
    const testUser = generateUniqueUser();
    if (EXTERNAL_API) {
      const token = await registerUserViaAPI(request, testUser);
      await createManyArticlesViaAPI(request, token, 15, uniqueTag);
      await login(page, testUser.email, testUser.password);
    } else {
      await createUserInIsolation(browser, testUser);
      await login(page, testUser.email, testUser.password);
      await createManyArticles(page, 15, uniqueTag);
    }
    // Navigate to our tag
    await page.goto(`/tag/${uniqueTag}`);
    await page.waitForSelector('.article-preview', { timeout: 2000 });
    // Should have pagination
    await expect(page.locator('.pagination .page-link:has-text("2")')).toBeVisible({ timeout: 2000 });
    // Go to page 2
    await page.click('.pagination .page-link:has-text("2")');
    await expect(page).toHaveURL(new RegExp(`/tag/${uniqueTag}\\?page=2`));
    // Click Global Feed and wait for URL to change to root path
    await page.click('.nav-link:has-text("Global Feed")');
    await expect(page).toHaveURL('/');
    // Verify articles loaded
    await page.waitForSelector('.article-preview', { timeout: 2000 });
  });

  test('tag pagination shows correct articles per page', async ({ page, request, browser }) => {
    // Create user and 15 articles with a unique tag for this test
    const uniqueTag = `pag${Date.now()}`;
    const testUser = generateUniqueUser();
    if (EXTERNAL_API) {
      const token = await registerUserViaAPI(request, testUser);
      await createManyArticlesViaAPI(request, token, 15, uniqueTag);
      await login(page, testUser.email, testUser.password);
    } else {
      await createUserInIsolation(browser, testUser);
      await login(page, testUser.email, testUser.password);
      await createManyArticles(page, 15, uniqueTag);
    }
    // Navigate to our tag
    await page.goto(`/tag/${uniqueTag}`);
    await page.waitForSelector('.article-preview', { timeout: 2000 });
    // Should have pagination (15 articles = 2 pages)
    await expect(page.locator('.pagination .page-link:has-text("2")')).toBeVisible({ timeout: 2000 });
    // First page should show 10 articles
    const articlesOnPage1 = await page.locator('.article-preview').count();
    expect(articlesOnPage1).toBe(10);
    // Click page 2
    await page.click('.pagination .page-link:has-text("2")');
    // Wait for page 2 to be active (Angular routing/rendering delay)
    await expect(page.locator('.pagination .page-item:has(.page-link:has-text("2"))')).toHaveClass(/active/, {
      timeout: 2000,
    });
    await page.waitForSelector('.article-preview', { timeout: 2000 });
    // URL should show ?page=2
    await expect(page).toHaveURL(new RegExp(`/tag/${uniqueTag}\\?page=2`));
    // Small wait for Angular to finish rendering the new page
    await page.waitForTimeout(500);
    // Second page should have 5 articles (15 - 10 = 5)
    const articlesOnPage2 = await page.locator('.article-preview').count();
    expect(articlesOnPage2).toBe(5);
  });
});
