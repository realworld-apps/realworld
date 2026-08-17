import { Page, Browser, APIRequestContext } from '@playwright/test';
import { register, generateUniqueUser } from './auth';
import { registerUserViaAPI, createManyArticles as createManyArticlesViaAPI } from './api';
import { EXTERNAL_API } from './config';

export interface UserCredentials {
  username: string;
  email: string;
  password: string;
}

/**
 * Create a user in an isolated browser context (when no external API is available)
 * or via API (default).
 */
export async function createUserInIsolation(
  browser: Browser,
  user?: UserCredentials,
): Promise<UserCredentials> {
  const u = user || generateUniqueUser();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await register(page, u.username, u.email, u.password);
  await ctx.close();
  return u;
}

/**
 * Create many articles for pagination tests.
 * Uses the external API when available (fast), falls back to form submissions.
 */
export async function createManyArticles(
  page: Page,
  count: number,
  tag: string = 'paginationtest',
  request?: APIRequestContext,
  token?: string,
): Promise<void> {
  if (EXTERNAL_API && request && token) {
    await createManyArticlesViaAPI(request, token, count, tag);
  } else {
    // Form-based: fill out the editor for each article
    const uniqueId = `${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
    for (let i = 0; i < count; i++) {
      await page.goto('/editor', { waitUntil: 'load' });
      await page.fill('input[name="title"]', `Test Article ${uniqueId} Number ${i}`);
      await page.fill('input[name="description"]', `Description for test article ${i}`);
      await page.fill('textarea[name="body"]', `Body content for test article ${i}. Created with ID ${uniqueId}.`);
      await page.fill('input[placeholder="Enter tags"]', tag);
      await page.press('input[placeholder="Enter tags"]', 'Enter');
      await Promise.all([
        page.waitForURL(/\/article\/.+/),
        page.click('button:has-text("Publish Article")'),
      ]);
    }
  }
}
