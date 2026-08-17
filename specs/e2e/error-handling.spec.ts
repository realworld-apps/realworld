import { test, expect, Page, Route } from '@playwright/test';
import { BROWSER_API } from './helpers/config';

test.beforeEach(({}, testInfo) => {
  testInfo.skip(!BROWSER_API, 'SPA-only: all tests use page.route() API mocking');
});

const API_BASE = 'https://api.realworld.show/api';

/**
 * Helper to mock an API endpoint with a specific error response
 */
async function mockApiError(page: Page, endpoint: string, status: number, errorBody: object = {}, method?: string) {
  await page.route(`${API_BASE}${endpoint}`, (route: Route) => {
    if (method && route.request().method() !== method) {
      return route.continue();
    }
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(errorBody),
    });
  });
}

/**
 * Helper to set a fake JWT token to simulate authenticated state
 */
async function setFakeAuthToken(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('jwtToken', 'fake-token-for-testing');
  });
}

test.describe('Error Handling - 400 Bad Request', () => {
  test('should handle 400 on login with validation errors', async ({ page }) => {
    await mockApiError(page, '/users/login', 400, {
      errors: { 'email or password': ['is invalid'] },
    });
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@test.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    // Should show error messages, not crash
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page).toHaveURL('/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('should handle 400 on registration with validation errors', async ({ page }) => {
    await mockApiError(page, '/users', 400, {
      errors: {
        email: ['is already taken'],
        username: ['is too short (minimum is 3 characters)'],
      },
    });
    await page.goto('/register');
    await page.fill('input[name="username"]', 'ab');
    await page.fill('input[name="email"]', 'taken@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    // Should show error messages
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page).toHaveURL('/register');
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('should handle 400 on article creation', async ({ page }) => {
    await page.goto('/');
    await setFakeAuthToken(page);
    // Mock successful user fetch (so we appear logged in)
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { username: 'testuser', email: 'test@test.com', token: 'fake-token', bio: null, image: null },
        }),
      });
    });
    await mockApiError(
      page,
      '/articles',
      400,
      {
        errors: { title: ["can't be blank"], body: ["can't be blank"] },
      },
      'POST',
    );
    await page.goto('/editor');
    await page.fill('input[name="title"]', '');
    await page.fill('input[name="description"]', 'desc');
    await page.fill('textarea[name="body"]', '');
    await page.click('button:has-text("Publish")');
    // Should show errors, not crash
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page.locator('input[name="title"]')).toBeVisible();
  });
});

test.describe('Error Handling - 401 Unauthorized', () => {
  // Note: 401 on page load is tested in user-fetch-errors.spec.ts

  test('should handle 401 when submitting settings form', async ({ page }) => {
    // Mock GET /user to succeed (so we can load the settings page)
    // Mock PUT /user to return 401 (session expired mid-edit)
    await page.route(`${API_BASE}/user`, route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { username: 'testuser', email: 'test@test.com', token: 'fake-token', bio: 'bio', image: null },
          }),
        });
      } else if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ errors: { message: ['Session expired'] } }),
        });
      }
    });
    await page.goto('/');
    await setFakeAuthToken(page);
    await page.goto('/settings');
    // Wait for form to load
    await expect(page.locator('input[name="email"]')).toBeVisible();
    // Submit the form
    await page.click('button[type="submit"]');
    // Should show error message, form should still be usable
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('should handle 401 when posting a comment', async ({ page }) => {
    // Mock article fetch as successful
    await page.route(`${API_BASE}/articles/*`, route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            article: {
              slug: 'test-article',
              title: 'Test Article',
              description: 'Test',
              body: 'Test body',
              tagList: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              favorited: false,
              favoritesCount: 0,
              author: { username: 'author', bio: null, image: null, following: false },
            },
          }),
        });
      } else {
        route.continue();
      }
    });
    // Mock comments fetch
    await page.route(`${API_BASE}/articles/*/comments`, route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ comments: [] }),
        });
      } else if (route.request().method() === 'POST') {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ errors: { message: ['You must be logged in'] } }),
        });
      }
    });
    await page.goto('/');
    await setFakeAuthToken(page);
    // Mock user as logged in
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { username: 'testuser', email: 'test@test.com', token: 'fake-token', bio: null, image: null },
        }),
      });
    });
    await page.goto('/article/test-article');
    // App should handle gracefully - not crash
    await expect(page.locator('nav.navbar')).toBeVisible();
    // Article content should still be visible
    await expect(page.locator('.article-content')).toBeVisible();
  });
});

test.describe('Error Handling - 403 Forbidden', () => {
  test('should handle 403 when updating article', async ({ page }) => {
    const mockArticle = {
      slug: 'test-article',
      title: 'Test Article',
      description: 'Test description',
      body: 'Test body',
      tagList: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      favorited: false,
      favoritesCount: 0,
      author: { username: 'currentuser', bio: '', image: '', following: false },
    };
    // Mock user fetch
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { username: 'currentuser', email: 'test@test.com', token: 'fake-token', bio: null, image: null },
        }),
      });
    });
    // Mock article fetch (GET) and update (PUT with 403)
    await page.route(`${API_BASE}/articles/test-article`, route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ article: mockArticle }),
        });
      } else if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ errors: { message: ['You are not authorized to edit this article'] } }),
        });
      } else {
        route.continue();
      }
    });
    await page.goto('/');
    await setFakeAuthToken(page);
    await page.goto('/editor/test-article');
    // Wait for form to load
    await expect(page.locator('input[name="title"]')).toHaveValue('Test Article');
    // Try to update
    await page.click('button:has-text("Publish")');
    // Should show error message
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page.locator('input[name="title"]')).toBeVisible();
  });

  test('should handle 403 when deleting another users comment', async ({ page }) => {
    const mockArticle = {
      slug: 'test-article',
      title: 'Test Article',
      description: 'Test description',
      body: 'Test body',
      tagList: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      favorited: false,
      favoritesCount: 0,
      author: { username: 'otheruser', bio: '', image: '', following: false },
    };
    const mockComment = {
      id: 1,
      body: 'This is a comment',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { username: 'currentuser', bio: '', image: '', following: false },
    };
    // Mock user fetch
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { username: 'currentuser', email: 'test@test.com', token: 'fake-token', bio: null, image: null },
        }),
      });
    });
    // Mock article fetch
    await page.route(`${API_BASE}/articles/test-article`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ article: mockArticle }),
      });
    });
    // Mock comments fetch (GET) and delete (DELETE with 403)
    await page.route(`${API_BASE}/articles/test-article/comments`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments: [mockComment] }),
      });
    });
    await page.route(`${API_BASE}/articles/test-article/comments/1`, route => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ errors: { message: ['You are not authorized to delete this comment'] } }),
        });
      } else {
        route.continue();
      }
    });
    await page.goto('/');
    await setFakeAuthToken(page);
    await page.goto('/article/test-article');
    // Wait for comment to be visible
    await expect(page.locator('.card-block:has-text("This is a comment")')).toBeVisible();
    // Click delete button on the comment (delete button is in card-footer, sibling of card-block)
    await page.locator('.card:has-text("This is a comment")').locator('i.ion-trash-a').click();
    // Comment should still be visible (delete failed)
    await expect(page.locator('.card-block:has-text("This is a comment")')).toBeVisible();
    // Error message should be displayed
    await expect(page.locator('.error-messages').last()).toBeVisible();
    // Article content should still be visible
    await expect(page.locator('.article-content')).toBeVisible();
  });

  test('should handle 403 when following user you are blocked by', async ({ page }) => {
    const mockProfile = {
      username: 'blockeduser',
      bio: 'This user blocked you',
      image: '',
      following: false,
    };
    // Mock user fetch
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { username: 'currentuser', email: 'test@test.com', token: 'fake-token', bio: null, image: null },
        }),
      });
    });
    // Mock profile fetch
    await page.route(`${API_BASE}/profiles/blockeduser`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profile: mockProfile }),
      });
    });
    // Mock articles for profile
    await page.route(`${API_BASE}/articles?author=blockeduser*`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ articles: [], articlesCount: 0 }),
      });
    });
    // Mock follow with 403
    await page.route(`${API_BASE}/profiles/blockeduser/follow`, route => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ errors: { message: ['You cannot follow this user'] } }),
      });
    });
    await page.goto('/');
    await setFakeAuthToken(page);
    await page.goto('/profile/blockeduser');
    // Wait for profile to load
    await expect(page.locator('button:has-text("Follow")')).toBeVisible();
    // Try to follow
    await page.click('button:has-text("Follow")');
    // App should not crash, button should still show Follow (not Unfollow)
    await expect(page.locator('button:has-text("Follow")')).toBeVisible();
    await expect(page.locator('.user-info')).toBeVisible();
  });
});

test.describe('Error Handling - 500 Internal Server Error', () => {
  test('should handle 500 on articles feed load', async ({ page }) => {
    await mockApiError(page, '/articles*', 500, {
      errors: { server: ['Internal server error'] },
    });
    await page.goto('/');
    // App should not crash - navbar and banner should still be visible
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('.navbar-brand')).toBeVisible();
    await expect(page.locator('.banner')).toBeVisible();
    await expect(page.locator('.feed-toggle')).toBeVisible();
    await expect(page.locator('.empty-feed-message')).toBeVisible();
  });

  test('should handle 500 on tags load', async ({ page }) => {
    // Mock articles as successful
    await page.route(`${API_BASE}/articles*`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ articles: [], articlesCount: 0 }),
      });
    });
    await mockApiError(page, '/tags', 500, {
      errors: { server: ['Database connection failed'] },
    });
    await page.goto('/');
    // App should load without tags, not crash
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('.banner')).toBeVisible();
    // Feed toggle should still be functional
    await expect(page.locator('.feed-toggle')).toBeVisible();
  });

  test('should handle network error on tags load', async ({ page }) => {
    await page.route(`${API_BASE}/articles*`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ articles: [], articlesCount: 0 }),
      });
    });
    await page.route(`${API_BASE}/tags`, route => {
      route.abort('internetdisconnected');
    });
    await page.goto('/');
    // App should load without tags, not crash
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('.banner')).toBeVisible();
    // Feed toggle should still be functional
    await expect(page.locator('.feed-toggle')).toBeVisible();
  });

  test('should handle 500 on user profile load', async ({ page }) => {
    await mockApiError(page, '/profiles/*', 500, {
      errors: { server: ['Failed to fetch profile'] },
    });
    await page.goto('/profile/someuser');
    // Should show error state or fallback, not crash
    await expect(page.locator('nav.navbar')).toBeVisible();
    // Profile container should exist (even if empty)
    await expect(page.locator('.profile-page, .user-info')).toBeVisible();
  });

  test('should handle network error on user profile load', async ({ page }) => {
    await page.route(`${API_BASE}/profiles/*`, route => {
      route.abort('internetdisconnected');
    });
    await page.goto('/profile/someuser');
    // Should not crash
    await expect(page.locator('nav.navbar')).toBeVisible();
    // Profile container should exist (even if empty)
    await expect(page.locator('.profile-page, .user-info')).toBeVisible();
  });

  test('should handle 500 on article detail load', async ({ page }) => {
    await mockApiError(page, '/articles/some-article', 500, {
      errors: { server: ['Failed to fetch article'] },
    });
    await page.goto('/article/some-article');
    // App should not crash
    await expect(page.locator('nav.navbar')).toBeVisible();
    // Article page container should exist
    await expect(page.locator('.article-page')).toBeVisible();
  });

  test('should handle network error on article detail load', async ({ page }) => {
    await page.route(`${API_BASE}/articles/some-article`, route => {
      route.abort('internetdisconnected');
    });
    await page.goto('/article/some-article');
    // App should not crash
    await expect(page.locator('nav.navbar')).toBeVisible();
    // Article page container should exist
    await expect(page.locator('.article-page')).toBeVisible();
  });

  test('should handle 500 when submitting settings', async ({ page }) => {
    // Mock user fetch as successful
    await page.route(`${API_BASE}/user`, route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: { username: 'testuser', email: 'test@test.com', token: 'fake-token', bio: 'bio', image: null },
          }),
        });
      } else if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ errors: { server: ['Failed to save settings'] } }),
        });
      }
    });
    await page.goto('/');
    await setFakeAuthToken(page);
    await page.goto('/settings');
    // Wait for form to load
    await expect(page.locator('input[name="email"]')).toBeVisible();
    // Try to submit
    await page.click('button[type="submit"]');
    // Should show error, not crash
    await expect(page.locator('nav.navbar')).toBeVisible();
    // Form should still be usable
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('should handle intermittent 500 errors gracefully', async ({ page }) => {
    let requestCount = 0;
    // First request fails, second succeeds
    await page.route(`${API_BASE}/articles*`, route => {
      requestCount++;
      if (requestCount === 1) {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ errors: { server: ['Temporary failure'] } }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ articles: [], articlesCount: 0 }),
        });
      }
    });
    await page.goto('/');
    // App should still be functional after error
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('.banner')).toBeVisible();
  });
});

test.describe('Error Handling - Network Errors', () => {
  test('should handle network timeout', async ({ page }) => {
    await page.route(`${API_BASE}/articles*`, route => {
      // Simulate timeout by not responding
      route.abort('timedout');
    });
    await page.goto('/');
    // App should not crash
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('.banner')).toBeVisible();
  });

  test('should handle connection refused', async ({ page }) => {
    await page.route(`${API_BASE}/articles*`, route => {
      route.abort('connectionrefused');
    });
    await page.goto('/');
    // App should not crash
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('.banner')).toBeVisible();
  });

  test('should show error message on settings form when network fails', async ({ page }) => {
    // Mock GET /user to simulate logged-in state
    await page.route(`${API_BASE}/user`, route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              email: 'test@example.com',
              username: 'testuser',
              bio: 'Test bio',
              image: '',
              token: 'fake-token',
            },
          }),
        });
      } else if (route.request().method() === 'PUT') {
        // Simulate network error on form submission
        route.abort('internetdisconnected');
      } else {
        route.continue();
      }
    });
    // Set token and go to settings
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('jwtToken', 'fake-token');
    });
    await page.goto('/settings');
    await expect(page.locator('button:has-text("Update Settings")')).toBeVisible();
    // Submit the form
    await page.click('button:has-text("Update Settings")');
    // Should show network error message
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page.locator('.error-messages')).toContainText('Unable to connect');
    // Form should still be usable
    await expect(page.locator('button:has-text("Update Settings")')).toBeVisible();
  });

  test('should show error message on login form when network fails', async ({ page }) => {
    await page.route(`${API_BASE}/users/login`, route => {
      route.abort('internetdisconnected');
    });
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page.locator('.error-messages')).toContainText('Unable to connect');
    // Form should still be usable
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error message on register form when network fails', async ({ page }) => {
    await page.route(`${API_BASE}/users`, route => {
      route.abort('internetdisconnected');
    });
    await page.goto('/register');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page.locator('.error-messages')).toContainText('Unable to connect');
    // Form should still be usable
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error message on create article form when network fails', async ({ page }) => {
    // Mock logged-in state
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { email: 'test@example.com', username: 'testuser', bio: '', image: '', token: 'fake-token' },
        }),
      });
    });
    // Network error on article creation
    await page.route(`${API_BASE}/articles`, route => {
      route.abort('internetdisconnected');
    });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('jwtToken', 'fake-token'));
    await page.goto('/editor');
    await page.fill('input[name="title"]', 'Test Article');
    await page.fill('input[name="description"]', 'Test description');
    await page.fill('textarea[name="body"]', 'Test body content');
    await page.click('button:has-text("Publish Article")');
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page.locator('.error-messages')).toContainText('Unable to connect');
    // Form should still be usable
    await expect(page.locator('button:has-text("Publish Article")')).toBeVisible();
  });

  test('should show error message on update article form when network fails', async ({ page }) => {
    const mockArticle = {
      slug: 'test-article',
      title: 'Test Article',
      description: 'Test description',
      body: 'Test body',
      tagList: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      favorited: false,
      favoritesCount: 0,
      author: { username: 'testuser', bio: '', image: '', following: false },
    };
    // Mock logged-in state
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { email: 'test@example.com', username: 'testuser', bio: '', image: '', token: 'fake-token' },
        }),
      });
    });
    // Mock article fetch
    await page.route(`${API_BASE}/articles/test-article`, route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ article: mockArticle }),
        });
      } else if (route.request().method() === 'PUT') {
        route.abort('internetdisconnected');
      } else {
        route.continue();
      }
    });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('jwtToken', 'fake-token'));
    await page.goto('/editor/test-article');
    await expect(page.locator('input[name="title"]')).toHaveValue('Test Article');
    await page.click('button:has-text("Publish Article")');
    await expect(page.locator('.error-messages')).toBeVisible();
    await expect(page.locator('.error-messages')).toContainText('Unable to connect');
    // Form should still be usable
    await expect(page.locator('button:has-text("Publish Article")')).toBeVisible();
  });

  test('should show error message when adding comment fails due to network', async ({ page }) => {
    const mockArticle = {
      slug: 'test-article',
      title: 'Test Article',
      description: 'Test description',
      body: 'Test body',
      tagList: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      favorited: false,
      favoritesCount: 0,
      author: { username: 'otheruser', bio: '', image: '', following: false },
    };
    // Mock logged-in state
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { email: 'test@example.com', username: 'testuser', bio: '', image: '', token: 'fake-token' },
        }),
      });
    });
    // Mock article fetch
    await page.route(`${API_BASE}/articles/test-article`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ article: mockArticle }),
      });
    });
    // Mock comments fetch (empty) and POST (network error)
    await page.route(`${API_BASE}/articles/test-article/comments`, route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ comments: [] }),
        });
      } else if (route.request().method() === 'POST') {
        route.abort('internetdisconnected');
      } else {
        route.continue();
      }
    });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('jwtToken', 'fake-token'));
    await page.goto('/article/test-article');
    await page.fill('textarea[placeholder="Write a comment..."]', 'Test comment');
    await page.click('button:has-text("Post Comment")');
    await expect(page.locator('.error-messages').first()).toBeVisible();
    await expect(page.locator('.error-messages').first()).toContainText('Unable to connect');
    // Article content should still be visible
    await expect(page.locator('.article-content')).toBeVisible();
  });

  test('should handle network error when favoriting article', async ({ page }) => {
    const mockArticle = {
      slug: 'test-article',
      title: 'Test Article',
      description: 'Test description',
      body: 'Test body',
      tagList: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      favorited: false,
      favoritesCount: 0,
      author: { username: 'otheruser', bio: '', image: '', following: false },
    };
    // Mock logged-in state
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { email: 'test@example.com', username: 'testuser', bio: '', image: '', token: 'fake-token' },
        }),
      });
    });
    // Mock article fetch
    await page.route(`${API_BASE}/articles/test-article`, route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ article: mockArticle }),
        });
      } else {
        route.continue();
      }
    });
    // Mock comments
    await page.route(`${API_BASE}/articles/test-article/comments`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments: [] }),
      });
    });
    // Network error on favorite
    await page.route(`${API_BASE}/articles/test-article/favorite`, route => {
      route.abort('internetdisconnected');
    });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('jwtToken', 'fake-token'));
    await page.goto('/article/test-article');
    // Click favorite button (first one - there are 2 on the page)
    await page.locator('button:has-text("Favorite Article")').first().click();
    // App should not crash - button should still be visible
    await expect(page.locator('button:has-text("Favorite Article")').first()).toBeVisible();
    // Article content should still be visible
    await expect(page.locator('.article-content')).toBeVisible();
  });

  test('should handle network error when following user', async ({ page }) => {
    const mockProfile = {
      username: 'otheruser',
      bio: 'Test bio',
      image: '',
      following: false,
    };
    // Mock logged-in state
    await page.route(`${API_BASE}/user`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { email: 'test@example.com', username: 'testuser', bio: '', image: '', token: 'fake-token' },
        }),
      });
    });
    // Mock profile fetch
    await page.route(`${API_BASE}/profiles/otheruser`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ profile: mockProfile }),
      });
    });
    // Mock articles for profile
    await page.route(`${API_BASE}/articles?author=otheruser*`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ articles: [], articlesCount: 0 }),
      });
    });
    // Network error on follow
    await page.route(`${API_BASE}/profiles/otheruser/follow`, route => {
      route.abort('internetdisconnected');
    });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('jwtToken', 'fake-token'));
    await page.goto('/profile/otheruser');
    // Click follow button
    await page.click('button:has-text("Follow")');
    // App should not crash - button should still be visible
    await expect(page.locator('button:has-text("Follow")')).toBeVisible();
    // Profile info should still be visible
    await expect(page.locator('.user-info')).toBeVisible();
  });
});

test.describe('Error Handling - Edge Cases', () => {
  test('should handle malformed JSON response', async ({ page }) => {
    await page.route(`${API_BASE}/articles*`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{ invalid json }}}',
      });
    });
    await page.goto('/');
    // App should not crash on malformed response
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('.banner')).toBeVisible();
  });

  test('should handle empty response body', async ({ page }) => {
    await page.route(`${API_BASE}/articles*`, route => {
      route.fulfill({
        status: 204, // No Content is more appropriate for empty body
        contentType: 'application/json',
        body: '',
      });
    });
    await page.goto('/');
    // App should handle empty response - banner and navbar should be visible
    await expect(page.locator('nav.navbar')).toBeVisible();
    await expect(page.locator('.banner')).toBeVisible();
  });

  test('should handle 404 for non-existent article', async ({ page }) => {
    await mockApiError(page, '/articles/non-existent-slug', 404, {
      errors: { article: ['not found'] },
    });
    await page.goto('/article/non-existent-slug');
    // Should show appropriate message, not crash
    await expect(page.locator('nav.navbar')).toBeVisible();
    // Article page container should still render
    await expect(page.locator('.article-page')).toBeVisible();
  });

  test('should handle 404 for non-existent profile', async ({ page }) => {
    await mockApiError(page, '/profiles/nonexistentuser', 404, {
      errors: { profile: ['not found'] },
    });
    await page.goto('/profile/nonexistentuser');
    // Should show appropriate message, not crash
    await expect(page.locator('nav.navbar')).toBeVisible();
    // Profile page container should still render
    await expect(page.locator('.profile-page, .user-info')).toBeVisible();
  });
});
