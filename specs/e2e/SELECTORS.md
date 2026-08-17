# RealWorld E2E Test Selectors Contract

This document lists every CSS class, HTML attribute, text label, route, and
interface that the shared e2e tests depend on. Any RealWorld implementation
that wants to use these tests **must** provide all of the selectors below.

---

## Form Inputs (`name` attributes)

Inputs are located via the standard HTML `name` attribute.

| Selector                                     | Page                      |
| -------------------------------------------- | ------------------------- |
| `input[name="username"]`                     | Register, Settings        |
| `input[name="email"]`                        | Login, Register, Settings |
| `input[name="password"]`                     | Login, Register, Settings |
| `input[name="title"]`                        | Editor                    |
| `input[name="description"]`                  | Editor                    |
| `textarea[name="body"]`                      | Editor                    |
| `input[name="image"]`                        | Settings                  |
| `textarea[name="bio"]`                       | Settings                  |
| `input[placeholder="Enter tags"]`            | Editor                    |
| `textarea[placeholder="Write a comment..."]` | Article detail            |

---

## CSS Classes

### Layout & Navigation

| Class           | Element | Purpose               |
| --------------- | ------- | --------------------- |
| `.navbar`       | `nav`   | Main navigation bar   |
| `.navbar-brand` | `a`     | Logo / site name link |
| `.nav-link`     | `a`     | Navigation tab links  |
| `.banner`       | `div`   | Home page hero banner |
| `.container`    | `div`   | Page width container  |

### Feed & Articles

| Class                 | Element | Purpose                                                       |
| --------------------- | ------- | ------------------------------------------------------------- |
| `.feed-toggle`        | `div`   | Global Feed / Your Feed tab bar                               |
| `.article-preview`    | `div`   | Article card in a feed list                                   |
| `.article-meta`       | `div`   | Author avatar + name + date                                   |
| `.article-content`    | `div`   | Rendered article body (markdown HTML: headings, lists, links) |
| `.article-page`       | `div`   | Article detail page wrapper                                   |
| `.preview-link`       | `a`     | Clickable link wrapping the preview                           |
| `.author`             | `a`     | Author name in article meta                                   |
| `.empty-feed-message` | `div`   | "No articles here" placeholder                                |

### Tags

| Class                                                | Element | Purpose                    |
| ---------------------------------------------------- | ------- | -------------------------- |
| `.sidebar`                                           | `div`   | Home page sidebar          |
| `.tag-list`                                          | `div`   | Container for tag pills    |
| `.tag-default`                                       | `span`  | Base tag class             |
| `.tag-pill`                                          | `span`  | Pill-shaped tag            |
| `.tag-list .tag-pill i` / `.tag-list .tag-default i` | `i`     | Remove a tag in the editor |

### Comments

| Class                 | Element | Purpose                                   |
| --------------------- | ------- | ----------------------------------------- |
| `.card`               | `div`   | Comment card (also wraps `.comment-form`) |
| `.card-block`         | `div`   | Comment text body                         |
| `.comment-form`       | `div`   | Comment input form card                   |
| `.comment-author-img` | `img`   | Commenter's avatar                        |
| `.mod-options`        | `span`  | Delete button container                   |
| `.ion-trash-a`        | `i`     | Delete icon (inside `.mod-options`)       |

Tests select posted comments with `.card:not(.comment-form) .card-block`.

### Profile

| Class           | Element | Purpose                       |
| --------------- | ------- | ----------------------------- |
| `.profile-page` | `div`   | Profile page wrapper          |
| `.user-info`    | `div`   | Username, bio, avatar section |
| `.user-img`     | `img`   | Large avatar on profile page  |
| `.user-pic`     | `img`   | Small avatar in the navbar    |

### Pagination

| Class         | Element   | Purpose                        |
| ------------- | --------- | ------------------------------ |
| `.pagination` | `nav/div` | Pagination container           |
| `.page-item`  | `li/div`  | Individual page button wrapper |

### Buttons

| Class                  | Element  | Purpose                        |
| ---------------------- | -------- | ------------------------------ |
| `.btn-outline-primary` | `button` | Favorite (not yet favorited)   |
| `.btn-primary`         | `button` | Unfavorite (already favorited) |
| `.btn-outline-danger`  | `button` | Destructive action (logout)    |

### Errors

| Class             | Element | Purpose                     |
| ----------------- | ------- | --------------------------- |
| `.error-messages` | `ul`    | Validation / API error list |

---

## Required Text Content

Buttons and links are located by visible text via `:has-text()`.

### Buttons

| Text                      | Element  | Context                  |
| ------------------------- | -------- | ------------------------ |
| `Post Comment`            | `button` | Article detail           |
| `Delete Article`          | `button` | Article detail           |
| `Publish Article`         | `button` | Editor                   |
| `Update Settings`         | `button` | Settings                 |
| `Or click here to logout` | `button` | Settings                 |
| `Follow` / `Unfollow`     | `button` | Profile, article meta    |
| `Favorite` / `Unfavorite` | `button` | Article detail           |
| `Favorite Article`        | `button` | Article detail (variant) |

### Headings & Links

| Text                    | Element      | Context               |
| ----------------------- | ------------ | --------------------- |
| `Sign in`               | `h1`         | Login page heading    |
| `Sign up`               | `h1`         | Register page heading |
| `Global Feed`           | `a.nav-link` | Home feed toggle      |
| `Your Feed`             | `a.nav-link` | Home feed toggle      |
| `Favorited`             | `a`          | Profile tab           |
| `Edit Article`          | `a`          | Article detail        |
| `Edit Profile Settings` | `a`          | Profile page          |
| `Home`                  | `a.nav-link` | Navbar                |

---

## Routes

### Pages

| Route                          | Page                      |
| ------------------------------ | ------------------------- |
| `/`                            | Home / Global Feed        |
| `/?feed=following`             | Your Feed                 |
| `/?page=N`                     | Paginated feed            |
| `/tag/:tag`                    | Filtered by tag           |
| `/tag/:tag?page=N`             | Paginated tag view        |
| `/login`                       | Login                     |
| `/register`                    | Register                  |
| `/editor`                      | New article               |
| `/editor/:slug`                | Edit article              |
| `/settings`                    | User settings             |
| `/profile/:username`           | User profile              |
| `/profile/:username/favorites` | User's favorited articles |
| `/article/:slug`               | Article detail            |

### API Endpoints (used in route interception)

| Endpoint                           | Methods          |
| ---------------------------------- | ---------------- |
| `/api/articles*`                   | GET              |
| `/api/articles/:slug`              | GET, PUT, DELETE |
| `/api/articles/:slug/comments`     | GET, POST        |
| `/api/articles/:slug/comments/:id` | DELETE           |
| `/api/articles/:slug/favorite`     | POST, DELETE     |
| `/api/users`                       | POST (register)  |
| `/api/users/login`                 | POST             |
| `/api/user`                        | GET, PUT         |
| `/api/profiles/:username`          | GET              |
| `/api/profiles/:username/follow`   | POST, DELETE     |
| `/api/tags`                        | GET              |

---

## Debug Interface (`window.__conduit_debug__`)

Implementations **must** expose this on `window.__conduit_debug__`:

```typescript
interface ConduitDebug {
  getToken(): string | null;
  getAuthState(): 'authenticated' | 'unauthenticated' | 'unavailable' | 'loading';
  getCurrentUser(): { username: string; email: string; bio: string | null; image: string | null; token: string } | null;
}
```

See `helpers/debug.ts` for the full contract and implementation guide.

---

## LocalStorage

| Key        | Value      | Purpose              |
| ---------- | ---------- | -------------------- |
| `jwtToken` | JWT string | Authentication token |

---

## Default Avatar

When a user's `image` is `null` or empty, the `src` attribute of avatar
images (`.user-img`, `.user-pic`, `.comment-author-img`, `.article-meta img`)
must contain `default-avatar.svg`.

---

## Button State Conventions

- **Favorite**: Uses `.btn-outline-primary` when not favorited, switches to `.btn-primary` when favorited.
- **Follow**: Button text toggles between `Follow {username}` and `Unfollow {username}`.
- **Pagination active**: The current page's `.page-item` has the CSS class `active`.
