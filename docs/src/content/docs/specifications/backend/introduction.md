---
title: Introduction
---

All backend implementations need to adhere to our [API spec](https://github.com/realworld-apps/realworld/tree/main/specs/api). The full API is described in the [OpenAPI spec](https://github.com/realworld-apps/realworld/blob/main/specs/api/openapi.yml).

For your convenience, we have a [Hurl collection](https://github.com/realworld-apps/realworld/tree/main/specs/api/hurl) that you can use to test your API endpoints as you build your app. You can run them all with [`run-api-tests-hurl.sh`](https://github.com/realworld-apps/realworld/blob/main/specs/api/run-api-tests-hurl.sh).

:::tip[The tests are the source of truth]
These pages summarize the contract in prose, but the [OpenAPI spec](https://github.com/realworld-apps/realworld/blob/main/specs/api/openapi.yml) and the [Hurl suite](https://github.com/realworld-apps/realworld/tree/main/specs/api/hurl) are what actually define it. Where the prose and the tests disagree, **the tests win** — so build against them, and if you find a discrepancy, please [open an issue](https://github.com/realworld-apps/realworld/issues).
:::

Once you're set up, read the rest of the backend specification: [Endpoints](/specifications/backend/endpoints/), [API response format](/specifications/backend/api-response-format/), and [Error handling](/specifications/backend/error-handling/). You can also start from our [starter kit](https://github.com/gothinkster/realworld-starter-kit).
