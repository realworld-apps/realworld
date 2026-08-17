/**
 * Test modes
 * ==========
 *
 * The suite supports three modes, selected with the TEST_MODE env var:
 *
 * - `spa` (default): the implementation is a browser client of a REST API.
 *   The browser issues the API calls itself and holds the JWT client-side,
 *   so tests may intercept API traffic (`page.route()`), inject tokens via
 *   `localStorage`, and wait on browser API responses. Cross-user scenarios
 *   use the demo backend's seeded users (e.g. `johndoe`).
 *
 * - `ssr`: the implementation renders on a server that talks to an external
 *   REST API on the browser's behalf (e.g. SvelteKit/Next.js server-rendered
 *   apps with httpOnly-cookie auth). There is no browser API traffic to
 *   intercept and no client-held token, so BROWSER_API tests skip — but the
 *   API is still reachable by the *test runner* for fast setup, and seeded
 *   demo users are available for cross-user scenarios.
 *
 * - `fullstack`: the implementation owns its entire stack (frontend and
 *   backend). No assumptions are made about a separately reachable API or
 *   seeded data: everything is driven through the UI, and cross-user
 *   scenarios create their own users.
 *
 * Specs should gate on the two capability flags below, not on TEST_MODE
 * directly — each flag captures one orthogonal assumption:
 *
 * | TEST_MODE | BROWSER_API | EXTERNAL_API |
 * | --------- | ----------- | ------------ |
 * | spa       | true        | true         |
 * | ssr       | false       | true         |
 * | fullstack | false       | false        |
 *
 * Backwards compatibility: the legacy boolean `API_MODE` env var still works
 * when TEST_MODE is unset (`API_MODE=false` -> fullstack, otherwise spa), and
 * the deprecated `API_MODE` export aliases BROWSER_API.
 */

export type TestMode = 'spa' | 'ssr' | 'fullstack';

function resolveMode(): TestMode {
  const mode = process.env.TEST_MODE?.toLowerCase();
  if (mode === 'spa' || mode === 'ssr' || mode === 'fullstack') return mode;
  if (mode) {
    throw new Error(`Unknown TEST_MODE "${process.env.TEST_MODE}" (expected spa | ssr | fullstack)`);
  }
  // legacy boolean: API_MODE=false meant fullstack, anything else spa
  return process.env.API_MODE?.toLowerCase() === 'false' ? 'fullstack' : 'spa';
}

export const TEST_MODE: TestMode = resolveMode();

/**
 * The app's browser bundle issues API calls itself and holds the JWT
 * client-side. Enables `page.route()` interception, `localStorage` token
 * injection, and waiting on browser API responses.
 */
export const BROWSER_API = TEST_MODE === 'spa';

/**
 * A known external API that the test runner can call directly for setup,
 * with seeded demo users (e.g. `johndoe`) for cross-user scenarios.
 */
export const EXTERNAL_API = TEST_MODE !== 'fullstack';

/** @deprecated gate on BROWSER_API (or EXTERNAL_API) instead */
export const API_MODE = BROWSER_API;

export const API_BASE = process.env.API_BASE || 'https://api.realworld.show/api';
