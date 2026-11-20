# GET unknown profile
GET {{host}}/api/profiles/unknown-user-{{uid}}
HTTP 404
[Asserts]
jsonpath "$.errors.profile[0]" == "not found"
jsonpath "$[?count($.*) == 1]" exists

# Follow no auth
POST {{host}}/api/profiles/unknown-user-{{uid}}/follow
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is missing"
jsonpath "$[?count($.*) == 1]" exists

# Unfollow no auth
DELETE {{host}}/api/profiles/unknown-user-{{uid}}/follow
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is missing"
jsonpath "$[?count($.*) == 1]" exists

# Setup: Register for authenticated 404 tests
POST {{host}}/api/users
{
  "user": {
    "username": "ep_{{uid}}",
    "email": "ep_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
token: jsonpath "$.user.token"

# Follow unknown user (authed)
POST {{host}}/api/profiles/unknown-user-{{uid}}/follow
Authorization: Token {{token}}
HTTP 404
[Asserts]
jsonpath "$.errors.profile[0]" == "not found"
jsonpath "$[?count($.*) == 1]" exists

# Unfollow unknown user (authed)
DELETE {{host}}/api/profiles/unknown-user-{{uid}}/follow
Authorization: Token {{token}}
HTTP 404
[Asserts]
jsonpath "$.errors.profile[0]" == "not found"
jsonpath "$[?count($.*) == 1]" exists
