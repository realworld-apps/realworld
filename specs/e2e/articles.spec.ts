import { test, expect } from '@playwright/test';
import { register, generateUniqueUser } from './helpers/auth';
import {
  createArticle,
  editArticle,
  deleteArticle,
  favoriteArticle,
  unfavoriteArticle,
  generateUniqueArticle,
} from './helpers/articles';
import { API_MODE } from './helpers/config';

test.describe('Articles', () => {
  test.beforeEach(async ({ page }) => {
    // Register and login before each test
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
  });

  test.afterEach(async ({ context }) => {
    // Close the browser context to ensure complete isolation between tests.
    // This releases browser instances, network connections, and other resources.
    await context.close();
    // Wait 500ms to allow async cleanup operations to complete.
    // Without this delay, running 6+ tests in sequence causes flaky failures
    // due to resource exhaustion (network connections, file descriptors, etc).
    // This timing issue manifests as timeouts when loading article pages.
    // This will be investigated and fixed later.
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  test('should create a new article', async ({ page }) => {
    const article = generateUniqueArticle();

    await createArticle(page, article);

    // Should be on article page
    await expect(page).toHaveURL(/\/article\/.+/);

    // Should show article content
    await expect(page.locator('h1')).toHaveText(article.title);
    await expect(page.locator('.article-content p')).toContainText(article.body);

    // Should show tags
    for (const tag of article.tags || []) {
      await expect(page.locator(`.tag-list .tag-default:has-text("${tag}")`)).toBeVisible();
    }
  });

  test('should edit an existing article', async ({ page }) => {
    const article = generateUniqueArticle();

    await createArticle(page, article);

    // Get the article slug from URL
    const url = page.url();
    const slug = url.split('/article/')[1];

    // Edit the article
    const updates = {
      title: `Updated ${article.title}`,
      description: `Updated ${article.description}`,
    };

    await editArticle(page, slug, updates);

    // Should show updated content
    await expect(page.locator('h1')).toHaveText(updates.title);
  });

  test('should delete an article', async ({ page }) => {
    const article = generateUniqueArticle();

    await createArticle(page, article);

    // Delete the article
    await deleteArticle(page);

    // Should be redirected to home
    await expect(page).toHaveURL('/');

    // Article should not appear on home page
    await expect(page.locator(`h1:has-text("${article.title}")`)).not.toBeVisible();
  });

  /**
   * Verifies the frontend handles HTTP 200 for article deletion.
   *
   * The RealWorld spec uses 204 No Content for DELETE operations, which is
   * semantically correct (success with no response body). However, HTTP clients
   * should accept ANY 2XX status as success per RFC 9110.
   *
   * This test mocks a 200 response to verify the frontend doesn't break when
   * an implementation returns 200 instead of 204. This is good engineering
   * practice: clients should handle status code classes, not specific codes.
   */
  test('should delete an article when server returns 200 instead of 204', async ({ page }) => {
    test.skip(!API_MODE, 'API-only: tests client-side HTTP status code handling via page.route()');
    const article = generateUniqueArticle();

    await createArticle(page, article);

    // Intercept DELETE requests and respond with 200 instead of 204
    await page.route('**/api/articles/*', async route => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({}),
        });
      } else {
        await route.continue();
      }
    });

    // Delete the article
    await deleteArticle(page);

    // Should be redirected to home (frontend should handle 200 the same as 204)
    await expect(page).toHaveURL('/');
  });

  test('should favorite an article', async ({ page }) => {
    // Use an existing article from the demo backend (can't favorite own articles)
    // Go to global feed to see all articles
    await page.goto('/', { waitUntil: 'load' });

    // Click on the first article to go to its detail page
    await page.click('.article-preview h1');
    await page.waitForLoadState('load');

    // Favorite the article using the helper (which expects to be on article detail page)
    await favoriteArticle(page);

    // Should see unfavorite button (use .first() since there are 2 buttons on the page)
    await expect(page.locator('button:has-text("Unfavorite")').first()).toBeVisible();
  });

  test('should unfavorite an article', async ({ page }) => {
    // Go to global feed to find an article from demo backend (not own article)
    await page.goto('/', { waitUntil: 'load' });

    // Wait for articles to load
    await page.waitForSelector('.article-preview', { timeout: 10000 });

    // Get the username of the currently logged in user from the navbar
    const currentUsername = await page.locator('nav a[href^="/profile/"]').first().textContent();

    // Find an article that's NOT from the current user
    const articles = await page.locator('.article-preview').all();
    let articleToFavorite = null;

    for (const article of articles) {
      const authorName = await article.locator('.author').textContent();
      if (authorName?.trim() !== currentUsername?.trim()) {
        articleToFavorite = article;
        break;
      }
    }

    if (!articleToFavorite) {
      throw new Error('No articles from other users found');
    }

    // Click on the article
    await articleToFavorite.locator('h1').click();
    await page.waitForURL(/\/article\/.+/);

    // Wait for article page to load - should see Favorite button (not Delete button)
    await page.waitForSelector('button:has-text("Favorite")', { timeout: 10000 });

    // Favorite it first
    await favoriteArticle(page);

    // Then unfavorite it
    await unfavoriteArticle(page);

    // Should see favorite button again (use .first() since there are 2 buttons on the page)
    await expect(page.locator('button:has-text("Favorite")').first()).toBeVisible();
  });

  test('should view article from home feed', async ({ page }) => {
    const article = generateUniqueArticle();

    await createArticle(page, article);

    // Go to global feed to see the article we just created
    await page.goto('/', { waitUntil: 'load' });

    // Wait for articles to load
    await page.waitForSelector('.article-preview', { timeout: 10000 });

    // Wait for our specific article to appear
    await page.locator('h1', { hasText: article.title }).first().waitFor({ timeout: 10000 });

    // Click on the article link in the feed (h1 is inside a link)
    await Promise.all([
      page.waitForURL(/\/article\/.+/),
      page.locator('h1', { hasText: article.title }).first().click(),
    ]);

    // Should be on article page
    await expect(page).toHaveURL(/\/article\/.+/);
    await expect(page.locator('h1')).toHaveText(article.title);
  });

  test('should display article preview correctly', async ({ page }) => {
    const article = generateUniqueArticle();

    await createArticle(page, article);

    // Go to global feed to see the article we just created
    await page.goto('/');

    // Article preview should show correct information
    const preview = page.locator('.article-preview').first();
    await expect(preview.locator('h1')).toHaveText(article.title);
    await expect(preview.locator('p')).toContainText(article.description);

    // Should show author info
    await expect(preview.locator('.author')).toBeVisible();

    // Should show tags
    for (const tag of article.tags || []) {
      await expect(preview.locator(`.tag-list .tag-default:has-text("${tag}")`)).toBeVisible();
    }
  });

  test('should remove all tags when editing an article', async ({ page }) => {
    const article = generateUniqueArticle();

    await createArticle(page, article);

    // Should show tags on the article page
    for (const tag of article.tags || []) {
      await expect(page.locator(`.tag-list .tag-default:has-text("${tag}")`)).toBeVisible();
    }

    // Get the article slug from URL
    const url = page.url();
    const slug = url.split('/article/')[1];

    // Go to the editor
    await page.goto(`/editor/${slug}`, { waitUntil: 'load' });

    // Wait for the form to be populated
    const titleInput = page.locator('input[name="title"]');
    await expect(titleInput).not.toHaveValue('', { timeout: 10000 });

    // Remove all tag pills by clicking their delete icons
    while (await page.locator('.tag-list .tag-pill i, .tag-list .tag-default i').count() > 0) {
      await page.locator('.tag-list .tag-pill i, .tag-list .tag-default i').first().click();
      await page.waitForTimeout(100);
    }

    // Intercept the PUT request to verify tagList is sent as [] (SPA-only: fullstack doesn't use fetch)
    let capturedTagList: unknown = undefined;
    if (API_MODE) {
      await page.route('**/api/articles/*', async route => {
        if (route.request().method() === 'PUT') {
          const body = route.request().postDataJSON();
          capturedTagList = body?.article?.tagList;
          await route.continue();
        } else {
          await route.continue();
        }
      });
    }

    // Publish
    await Promise.all([page.waitForURL(/\/article\/.+/), page.click('button:has-text("Publish Article")')]);

    // Verify the frontend sent tagList: [] (not undefined/omitted) — SPA only
    if (API_MODE) {
      expect(capturedTagList).toEqual([]);
    }

    // Verify no tags on the article page
    await expect(page.locator('.tag-list .tag-default')).toHaveCount(0);
  });

  test('should only allow author to edit/delete article', async ({ page, browser }) => {
    const article = generateUniqueArticle();

    // Create article as first user
    await createArticle(page, article);

    // Get article URL
    const articleUrl = page.url();

    // Create a second user in new context (not sharing cookies with first user)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const user2 = generateUniqueUser();
    await register(page2, user2.username, user2.email, user2.password);

    // Visit the article as second user
    await page2.goto(articleUrl);

    // Should not see Edit/Delete buttons
    await expect(page2.locator('a:has-text("Edit Article")')).not.toBeVisible();
    await expect(page2.locator('button:has-text("Delete Article")')).not.toBeVisible();

    await context2.close();
  });
});
