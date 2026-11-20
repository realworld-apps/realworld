# RealWorld API Spec

## Running API tests locally

### With Hurl

To locally run the provided [Hurl](https://hurl.dev) collection against your backend, execute:

```
HOST=http://localhost:3000 ./run-api-tests-hurl.sh
```

`HOST` is the base URL of your server, without `/api`: the requests already start with `/api` (e.g. `{{host}}/api/users`).

For more details, see [`run-api-tests-hurl.sh`](run-api-tests-hurl.sh).

### With Bruno

A [Bruno](https://www.usebruno.com) collection is also available, automatically generated from the Hurl test suite. To run it:

```
HOST=http://localhost:3000 ./run-api-tests-bruno.sh
```

For more details, see [`run-api-tests-bruno.sh`](run-api-tests-bruno.sh).

You can also open the `bruno/` folder directly in the Bruno app to run and inspect requests interactively.

> **Note:** The Hurl files are the source of truth. The Bruno collection is generated with `make bruno-generate` and kept in sync via CI (`make bruno-check`).
