import { test, expect } from '@playwright/test';
import { register, generateUniqueUser } from './helpers/auth';
import { createArticle, generateUniqueArticle } from './helpers/articles';
import { addComment, deleteComment, getCommentCount } from './helpers/comments';
import { BROWSER_API } from './helpers/config';

test.describe('Comments', () => {
  // Force each test to use a fresh browser context
  test.use({ storageState: undefined });

  test.beforeEach(async ({ page }) => {
    // Register and login, then create an article
    const user = generateUniqueUser();
    await register(page, user.username, user.email, user.password);
    const article = generateUniqueArticle();
    await createArticle(page, article);
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

  test('should add a comment to an article', async ({ page }) => {
    const commentText = 'This is a test comment from Playwright!';
    await addComment(page, commentText);
    // Comment should be visible
    await expect(page.locator(`.card:not(.comment-form) .card-block:has-text("${commentText}")`)).toBeVisible();
  });

  test('should delete own comment', async ({ page }) => {
    const commentText = 'Comment to be deleted';
    await addComment(page, commentText);
    // Comment should be visible
    await expect(page.locator(`.card:not(.comment-form) .card-block:has-text("${commentText}")`)).toBeVisible();
    // Delete the comment
    await deleteComment(page, commentText);
    // Comment should no longer be visible
    await expect(page.locator(`.card:not(.comment-form) .card-block:has-text("${commentText}")`)).not.toBeVisible();
  });

  /**
   * Verifies the frontend handles HTTP 200 for comment deletion.
   *
   * The RealWorld spec uses 204 No Content for DELETE operations, which is
   * semantically correct (success with no response body). However, HTTP clients
   * should accept ANY 2XX status as success per RFC 9110.
   *
   * This test mocks a 200 response to verify the frontend doesn't break when
   * an implementation returns 200 instead of 204. This is good engineering
   * practice: clients should handle status code classes, not specific codes.
   */
  test('should delete comment when server returns 200 instead of 204', async ({ page }) => {
    test.skip(!BROWSER_API, 'SPA-only: tests client-side HTTP status code handling via page.route()');
    const commentText = 'Comment to test 200 status';
    await addComment(page, commentText);
    // Comment should be visible
    await expect(page.locator(`.card:not(.comment-form) .card-block:has-text("${commentText}")`)).toBeVisible();

    // Intercept DELETE requests to comments and respond with 200 instead of 204
    await page.route('**/api/articles/*/comments/*', async route => {
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

    // Delete the comment
    await deleteComment(page, commentText);
    // Comment should no longer be visible (frontend should handle 200 the same as 204)
    await expect(page.locator(`.card:not(.comment-form) .card-block:has-text("${commentText}")`)).not.toBeVisible();
  });

  test('should display multiple comments', async ({ page }) => {
    const comment1 = 'First comment';
    const comment2 = 'Second comment';
    const comment3 = 'Third comment';
    await addComment(page, comment1);
    await addComment(page, comment2);
    await addComment(page, comment3);
    // All comments should be visible (exclude comment form)
    await expect(page.locator(`.card:not(.comment-form) .card-block:has-text("${comment1}")`)).toBeVisible();
    await expect(page.locator(`.card:not(.comment-form) .card-block:has-text("${comment2}")`)).toBeVisible();
    await expect(page.locator(`.card:not(.comment-form) .card-block:has-text("${comment3}")`)).toBeVisible();
    // Should have exactly 3 comments
    const count = await getCommentCount(page);
    expect(count).toBe(3);
  });

  test('should require login to post comment', async ({ page, browser }) => {
    // Create a new context without authentication (not sharing cookies with page)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    // Visit the article and wait for navigation
    await page2.goto(page.url(), { waitUntil: 'load' });
    // Wait for Angular to complete auth check - either comment form OR sign in link appears
    await page2.waitForSelector('textarea[placeholder="Write a comment..."], a[href="/login"]', { timeout: 10000 });
    // Should see sign in/sign up links instead of comment form
    await expect(page2.locator('a[href="/login"]')).toBeVisible();
    await expect(page2.locator('textarea[placeholder="Write a comment..."]')).not.toBeVisible();
    await context2.close();
  });

  test('should only allow comment author to delete', async ({ page }) => {
    // Use an existing demo article from the backend (e.g., johndoe's article)
    // This avoids session isolation issues
    // Go to global feed to see all articles
    await page.goto('/', { waitUntil: 'load' });
    // Wait for article to be fully loaded and clickable
    await expect(page.locator('.article-preview h1').first()).toBeVisible({ timeout: 15000 });
    // Click on first article from demo backend (likely has existing comments)
    await page.click('.article-preview h1');
    await page.waitForURL(/\/article\/.+/, { timeout: 10000 });
    // Check if there are any existing comments (from other users like johndoe)
    const existingCommentsCount = await page.locator('.card:not(.comment-form)').count();
    // If there are existing comments, they should NOT have delete buttons (not our comments)
    if (existingCommentsCount > 0) {
      const firstExistingComment = page.locator('.card:not(.comment-form)').first();
      await expect(firstExistingComment.locator('span.mod-options i.ion-trash-a')).not.toBeVisible();
    }
    // Now add our own comment
    const commentText = `Comment by logged in user ${Date.now()}`;
    await addComment(page, commentText);
    // Verify the delete button IS visible for OUR comment
    const ownComment = page.locator('.card', { has: page.locator(`text="${commentText}"`) });
    await expect(ownComment.locator('span.mod-options i.ion-trash-a')).toBeVisible();
  });

  test('should handle long comments', async ({ page }) => {
    const longComment = 'This is a very long comment. '.repeat(50);
    await addComment(page, longComment);
    // Comment should be visible and properly formatted (comment text is in a paragraph)
    await expect(page.locator('p').filter({ hasText: longComment })).toBeVisible();
  });

  test('should preserve comments after page reload', async ({ page }) => {
    const commentText = 'Persistent comment';
    await addComment(page, commentText);
    // Reload the page
    await page.reload();
    // Comment should still be visible
    await expect(page.locator(`.card:not(.comment-form) .card-block:has-text("${commentText}")`)).toBeVisible();
  });

  test('should clear comment form after posting', async ({ page }) => {
    const commentText = 'Test comment';
    await addComment(page, commentText);
    // Comment textarea should be empty
    await expect(page.locator('textarea[placeholder="Write a comment..."]')).toHaveValue('');
  });
});
