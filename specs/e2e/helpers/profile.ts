import { Page } from '@playwright/test';
import { BROWSER_API } from './config';

export async function followUser(page: Page, username: string) {
  await page.goto(`/profile/${username}`, { waitUntil: 'load' });
  // Wait for profile page to load and Follow button to appear
  await page.waitForSelector('button:has-text("Follow")', { timeout: 10000 });
  await page.click('button:has-text("Follow")');
  // Wait for button to update
  await page.waitForSelector('button:has-text("Unfollow")', { timeout: 5000 });
}

export async function unfollowUser(page: Page, username: string) {
  await page.goto(`/profile/${username}`, { waitUntil: 'load' });
  // Wait for profile page to load and Unfollow button to appear
  await page.waitForSelector('button:has-text("Unfollow")', { timeout: 10000 });
  await page.click('button:has-text("Unfollow")');
  // Wait for button to update
  await page.waitForSelector('button:has-text("Follow")', { timeout: 5000 });
}

export async function updateProfile(
  page: Page,
  updates: {
    image?: string;
    username?: string;
    bio?: string;
    email?: string;
    password?: string;
  },
) {
  await page.goto('/settings', { waitUntil: 'load' });

  if (updates.image !== undefined) {
    await page.fill('input[name="image"]', updates.image);
  }
  if (updates.username) {
    await page.fill('input[name="username"]', updates.username);
  }
  if (updates.bio !== undefined) {
    await page.fill('textarea[name="bio"]', updates.bio);
  }
  if (updates.email) {
    await page.fill('input[name="email"]', updates.email);
  }
  if (updates.password) {
    await page.fill('input[name="password"]', updates.password);
  }

  if (BROWSER_API) {
    // Click submit and wait for API call to complete, then navigation
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/user') && response.request().method() === 'PUT'),
      page.waitForURL(url => !url.toString().includes('/settings')),
      page.click('button[type="submit"]'),
    ]);
  } else {
    // Click submit and wait for navigation away from settings
    await Promise.all([
      page.waitForURL(url => !url.toString().includes('/settings')),
      page.click('button[type="submit"]'),
    ]);
  }
}
