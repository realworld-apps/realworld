---
title: Error handling
---

### Errors and Status Codes

If a request fails any validations, expect a 422 and errors in the following format:

```json
{
  "errors":{
    "body": [
      "can't be empty"
    ]
  }
}
```

#### Validation messages

The API test suite asserts on the following messages, keyed by the field name:

| Message                  | Used when                                                             |
| ------------------------ | --------------------------------------------------------------------- |
| `can't be blank`         | a required field is missing, `null` or an empty string                |
| `is invalid`             | a field has the wrong format, e.g. `email` is not a valid email address |
| `has already been taken` | a unique field (`username`, `email`) is already used by another user  |

Email fields (`POST /api/users`, `POST /api/users/login`, `PUT /api/user`) must be a valid
email address (`format: email` in the OpenAPI schema). A malformed value is rejected with a
422 and `{"errors": {"email": ["is invalid"]}}`.

#### Other status codes:

401 for Unauthorized requests, when a request requires authentication but it isn't provided

403 for Forbidden requests, when a request may be valid but the user doesn't have permissions to perform the action

404 for Not found requests, when a resource can't be found to fulfill the request
