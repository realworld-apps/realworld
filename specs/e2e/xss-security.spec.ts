import { test, expect, Page } from '@playwright/test';
import { generateUniqueUser, login } from './helpers/auth';
import { registerUserViaAPI, updateUserViaAPI, createArticleViaAPI } from './helpers/api';
import { BROWSER_API, EXTERNAL_API } from './helpers/config';

test.beforeEach(({ }, testInfo) => {
  testInfo.skip(!EXTERNAL_API, 'needs an external API: payloads are injected via direct API calls');
});

/**
 * XSS Security Tests - BASIC SMOKE TESTS ONLY
 *
 * ⚠️  IMPORTANT DISCLAIMER ⚠️
 *
 * These tests are NOT a comprehensive security audit. They only check for a few
 * common, naive XSS attack patterns and should NOT give you a false sense of security.
 *
 * What these tests DO:
 * - Verify basic protection against common XSS payloads in image URLs
 * - Check that basic sanitization is present and working for markdown / urls
 * - Catch obvious security regressions
 *
 * What these tests DO NOT:
 * - Cover all possible XSS vectors (this a whole different scope) and bypass techniques
 * - Replace a proper security audit / penetration testing
 * - Actually guarantee the application is secure against XSS
 *
 * For production applications, you should:
 * - Conduct regular security audits by professionals
 * - Use automated security scanning tools (OWASP ZAP, Burp Suite, etc.)
 * - Implement Content Security Policy (CSP) headers
 * - Keep dependencies updated (especially sanitization libraries)
 * - Follow OWASP guidelines: https://owasp.org/www-community/xss-filter-evasion-cheatsheet
 *
 * IMPORTANT: These tests inject malicious payloads directly via API (POST/PUT),
 * bypassing any UI-level sanitization. This simulates a real attack where an
 * attacker uses curl/Postman to inject malicious data directly into the backend.
 *
 * Reference: https://github.com/realworld-apps/realworld/issues/525
 */

// Common XSS payloads targeting image src attribute
const XSS_IMAGE_PAYLOADS = [
  {
    name: 'onerror attribute injection',
    payload: 'https://example.com/img.jpg"onerror="alert(1)',
  },
  {
    name: 'onerror with javascript protocol',
    payload: 'https://example.com/img.jpg"onerror="javascript:alert(document.cookie)',
  },
  {
    name: 'onload attribute injection',
    payload: 'https://example.com/img.jpg"onload="alert(1)',
  },
  {
    name: 'javascript protocol in src',
    payload: 'javascript:alert(1)',
  },
  {
    name: 'data URI with script',
    payload: 'data:text/html,<script>alert(1)</script>',
  },
];

// XSS payloads targeting markdown/HTML content (article body)
const XSS_MARKDOWN_PAYLOADS = [
  {
    name: 'script tag',
    payload: '<script>alert(1)</script>',
  },
  {
    name: 'img onerror',
    payload: '<img src=x onerror="alert(1)">',
  },
  {
    name: 'svg onload',
    payload: '<svg onload="alert(1)">',
  },
  {
    name: 'iframe srcdoc',
    payload: '<iframe srcdoc="<script>alert(1)</script>">',
  },
  {
    name: 'anchor javascript href',
    payload: '<a href="javascript:alert(1)">click me</a>',
  },
  {
    name: 'event handler in div',
    payload: '<div onmouseover="alert(1)">hover me</div>',
  },
];

/**
 * Sets up a listener for any dialog (alert, confirm, prompt) on the page.
 * Returns a function that checks if any dialog was triggered.
 */
function setupXssDetector(page: Page): () => boolean {
  let xssTriggered = false;
  page.on('dialog', async dialog => {
    xssTriggered = true;
    await dialog.dismiss();
  });
  return () => xssTriggered;
}

/**
 * Injects the JWT token into the browser's localStorage to authenticate the session.
 */
async function injectToken(page: Page, token: string): Promise<void> {
  await page.goto('/');
  await page.evaluate(t => {
    localStorage.setItem('jwtToken', t);
  }, token);
}

/**
 * Authenticates the page session. SPA mode injects the JWT into the browser's
 * localStorage (fast path); otherwise logs in through the UI, which works for
 * any architecture (e.g. ssr implementations with httpOnly-cookie auth).
 */
async function authenticate(
  page: Page,
  token: string,
  user: { email: string; password: string },
): Promise<void> {
  if (BROWSER_API) {
    await injectToken(page, token);
  } else {
    await login(page, user.email, user.password);
  }
}

test.describe('@security XSS Security - Image URL Injection (Direct API)', () => {
  for (const { name, payload } of XSS_IMAGE_PAYLOADS) {
    test(`should prevent XSS via ${name}`, async ({ page, request }) => {
      const wasXssTriggered = setupXssDetector(page);
      // Register user via API
      const user = generateUniqueUser();
      const token = await registerUserViaAPI(request, user);
      // Inject malicious image URL directly via API (bypassing UI)
      await updateUserViaAPI(request, token, { image: payload });
      // Now visit the profile page as a "victim" viewing this profile
      await authenticate(page, token, user);
      await page.goto(`/profile/${user.username}`);
      await expect(page).toHaveURL(new RegExp(`/profile/${user.username}`));
      // Wait for profile to load (user-info section contains the image)
      await page.waitForSelector('.user-info', { timeout: 10000 });
      // Wait for any deferred/async XSS payloads to execute
      await page.waitForTimeout(1500);
      // Verify no XSS was triggered
      expect(wasXssTriggered()).toBe(false);
      // Verify the malicious payload is NOT in an executable context
      const imgElement = page.locator('.user-img');
      await expect(imgElement).toBeVisible();
      // Check that onerror/onload are not attributes on the img element
      const hasOnerror = await imgElement.evaluate(el => el.hasAttribute('onerror'));
      expect(hasOnerror).toBe(false);
      const hasOnload = await imgElement.evaluate(el => el.hasAttribute('onload'));
      expect(hasOnload).toBe(false);
    });
  }

  test('should safely render malicious payload in navbar image', async ({ page, request }) => {
    const wasXssTriggered = setupXssDetector(page);
    // Register and inject malicious image via API
    const user = generateUniqueUser();
    const token = await registerUserViaAPI(request, user);
    const maliciousImage = 'https://x.com/img.jpg"onerror="alert(document.cookie)';
    await updateUserViaAPI(request, token, { image: maliciousImage });
    // Authenticate and navigate around to trigger navbar re-renders
    await authenticate(page, token, user);
    await page.goto('/');
    await page.waitForTimeout(1000);
    await page.goto('/settings');
    await page.waitForTimeout(1000);
    // Check navbar image doesn't have event handlers
    const navbarImg = page.locator('nav .user-pic');
    if (await navbarImg.isVisible()) {
      const hasOnerror = await navbarImg.evaluate(el => el.hasAttribute('onerror'));
      expect(hasOnerror).toBe(false);
    }
    expect(wasXssTriggered()).toBe(false);
  });

  test('should safely render malicious payload in article comments', async ({ page, request }) => {
    const wasXssTriggered = setupXssDetector(page);
    // Register and inject malicious image via API
    const user = generateUniqueUser();
    const token = await registerUserViaAPI(request, user);
    const maliciousImage = 'https://x.com/img.jpg"onerror="alert(1)';
    await updateUserViaAPI(request, token, { image: maliciousImage });
    // Authenticate and go to an article
    await authenticate(page, token, user);
    await page.goto('/');
    await page.waitForSelector('.article-preview a.preview-link, .article-preview');
    // Click on the first article
    const articleLink = page.locator('.article-preview a.preview-link').first();
    if (await articleLink.isVisible()) {
      await articleLink.click();
      await page.waitForURL(/\/article\//);
      // Wait for comment section to load and any XSS to trigger
      await page.waitForTimeout(1500);
      // The user's image appears in the comment form
      const commentAuthorImg = page.locator('.comment-author-img').first();
      if (await commentAuthorImg.isVisible()) {
        const hasOnerror = await commentAuthorImg.evaluate(el => el.hasAttribute('onerror'));
        expect(hasOnerror).toBe(false);
      }
    }
    expect(wasXssTriggered()).toBe(false);
  });
});

test.describe('@security XSS Security - Article Description in Feed (Direct API)', () => {
  const XSS_DESCRIPTION_PAYLOADS = [
    { name: 'script tag', payload: '<script>alert(1)</script>' },
    { name: 'img onerror', payload: '<img src=x onerror="alert(1)">' },
    { name: 'svg onload', payload: '<svg onload="alert(1)">' },
  ];
  for (const { name, payload } of XSS_DESCRIPTION_PAYLOADS) {
    test(`should sanitize ${name} in article description`, async ({ page, request }) => {
      const wasXssTriggered = setupXssDetector(page);
      // Register user and create article with malicious description via API
      const user = generateUniqueUser();
      const token = await registerUserViaAPI(request, user);
      const timestamp = Date.now();
      await createArticleViaAPI(request, token, {
        title: `XSS Desc Test ${timestamp}`,
        description: `Before: ${payload} After`,
        body: 'Normal body content',
      });
      // Authenticate and visit user's profile to see their articles
      await authenticate(page, token, user);
      await page.goto(`/profile/${user.username}`);
      // Wait for article preview to render
      await page.waitForSelector('.article-preview', { timeout: 10000 });
      // Wait for any XSS to trigger
      await page.waitForTimeout(1500);
      // Verify no XSS was triggered
      expect(wasXssTriggered()).toBe(false);
      // Check the description doesn't contain executable elements
      const description = page.locator('.article-preview p').first();
      if (await description.isVisible()) {
        // The payload should be visible as escaped text, not executed
        const text = await description.textContent();
        expect(text).toContain('Before:');
        // Verify no script tags were injected into the DOM
        const scriptCount = await page.locator('.article-preview script').count();
        expect(scriptCount).toBe(0);
      }
    });
  }
});

test.describe('@security XSS Security - Article Body Markdown (Direct API)', () => {
  for (const { name, payload } of XSS_MARKDOWN_PAYLOADS) {
    test(`should sanitize ${name} in article body`, async ({ page, request }) => {
      const wasXssTriggered = setupXssDetector(page);
      // Register user and create article with malicious body via API
      const user = generateUniqueUser();
      const token = await registerUserViaAPI(request, user);
      const timestamp = Date.now();
      const slug = await createArticleViaAPI(request, token, {
        title: `XSS Test ${timestamp}`,
        description: 'Testing XSS protection',
        body: `Before payload: ${payload} After payload`,
      });
      // Authenticate FIRST (session isolation - must be same user to view article)
      await authenticate(page, token, user);
      // Now visit the article page as the authenticated user
      await page.goto(`/article/${slug}`);
      // Wait for content to render
      await page.waitForSelector('.article-content', { timeout: 10000 });
      // Wait for any XSS to trigger
      await page.waitForTimeout(1500);
      // Verify no XSS was triggered
      expect(wasXssTriggered()).toBe(false);
      // Check the article body container for dangerous elements/attributes
      const articleBody = page.locator('.article-content');
      await expect(articleBody).toBeVisible();
      // Verify no script tags exist
      const scriptCount = await articleBody.locator('script').count();
      expect(scriptCount).toBe(0);
      // Verify no elements with dangerous event handlers
      const dangerousHandlers = ['onerror', 'onload', 'onmouseover', 'onclick', 'onfocus'];
      for (const handler of dangerousHandlers) {
        const elementsWithHandler = await articleBody.locator(`[${handler}]`).count();
        expect(elementsWithHandler).toBe(0);
      }
    });
  }
});
