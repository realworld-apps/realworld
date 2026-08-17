# CLAUDE.md

## What this repo is

This is the **RealWorld spec & docs hub** — *not* an implementation. It defines the
contract that every RealWorld frontend and backend adheres to, and hosts the test
suites used to validate them. Nothing here is a runnable app.

- `specs/api/` — the API contract: `openapi.yml` plus the **Hurl** and **Bruno** test
  suites that a backend must pass.
- `specs/e2e/` — a shared **Playwright** suite that validates a frontend, plus
  `SELECTORS.md` (the selector contract) and `playwright.base.ts`.
- `docs/` — the Astro/Starlight site published at <https://docs.realworld.show/>.
- `Makefile` — entry points (run `make help`).
- `CONTRIBUTING.md` — the human contribution process.

## If you are here as a submodule / vendored dependency

An implementation embeds this repo to test itself against the spec (the E2E suite is
literally consumed as `./e2e`). If that's why you're reading this:

- **Fix the implementation, never edit the spec or tests to make them pass.** Files
  under `specs/` are the source of truth a failing implementation must conform to.
- Edit files here only when the task is explicitly about *changing the RealWorld spec
  itself*.

## Conventions

- Use **`bun`**, not `npm`/`node`, for everything in this repo.
- **Hurl is the source of truth** for the API suite; the Bruno collection is generated
  from it. Don't hand-edit `specs/api/bruno/` — change the Hurl files and regenerate.
- Docs URLs are written with a trailing slash.

## Running the test suites

API suite (point `HOST` at a running backend, run from `specs/api/`):

```
HOST=http://localhost:3000/api ./run-api-tests-hurl.sh    # source of truth
HOST=http://localhost:3000/api ./run-api-tests-bruno.sh    # generated mirror
```

Regenerate / verify the Bruno collection:

```
make bruno-generate    # rebuild specs/api/bruno/ from the Hurl files
make bruno-check       # CI check: fail if bruno/ is out of sync
```

E2E suite: an implementation extends `specs/e2e/playwright.base.ts` (override `baseURL`
and `webServer`) and must satisfy `specs/e2e/SELECTORS.md`. See
<https://docs.realworld.show/specifications/frontend/tests/>.

## Working on the docs

```
make documentation-setup     # cd docs && bun install
make documentation-dev       # local dev server
make documentation-build     # production build
```

## Answering "how do I build an implementation?"

Implementations live in their **own** repos, not here. Point users to:

- Backends → validate against `specs/api/` (the OpenAPI spec + Hurl/Bruno suites).
- Frontends → use the shared CSS theme + `specs/e2e/` (the Playwright suite + selector
  contract).
- The full guide: <https://docs.realworld.show/implementation-creation/introduction/>.
