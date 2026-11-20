# Post comment no auth
POST {{host}}/api/articles/some-slug/comments
{
  "comment": {
    "body": "test"
  }
}
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is missing"
jsonpath "$[?count($.*) == 1]" exists

# Delete comment no auth
DELETE {{host}}/api/articles/some-slug/comments/1
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is missing"
jsonpath "$[?count($.*) == 1]" exists

# Setup: Register + create article
POST {{host}}/api/users
{
  "user": {
    "username": "ec_{{uid}}",
    "email": "ec_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
token: jsonpath "$.user.token"

POST {{host}}/api/articles
Authorization: Token {{token}}
{
  "article": {
    "title": "Err Comment Art {{uid}}",
    "description": "test",
    "body": "test"
  }
}
HTTP 201
[Captures]
slug: jsonpath "$.article.slug"

# Post comment empty body
POST {{host}}/api/articles/{{slug}}/comments
Authorization: Token {{token}}
{
  "comment": {
    "body": ""
  }
}
HTTP 422
[Asserts]
jsonpath "$.errors.body[0]" == "can't be blank"
jsonpath "$[?count($.*) == 1]" exists

# Post comment on unknown article
POST {{host}}/api/articles/unknown-slug-{{uid}}/comments
Authorization: Token {{token}}
{
  "comment": {
    "body": "orphan"
  }
}
HTTP 404
[Asserts]
jsonpath "$.errors.article[0]" == "not found"
jsonpath "$[?count($.*) == 1]" exists

# Get comments on unknown article
GET {{host}}/api/articles/unknown-slug-{{uid}}/comments
HTTP 404
[Asserts]
jsonpath "$.errors.article[0]" == "not found"
jsonpath "$[?count($.*) == 1]" exists

# Delete comment on unknown article
DELETE {{host}}/api/articles/unknown-slug-{{uid}}/comments/99999
Authorization: Token {{token}}
HTTP 404
[Asserts]
jsonpath "$.errors.article[0]" == "not found"
jsonpath "$[?count($.*) == 1]" exists

# Delete non-existent comment on existing article
DELETE {{host}}/api/articles/{{slug}}/comments/99999
Authorization: Token {{token}}
HTTP 404
[Asserts]
jsonpath "$.errors.comment[0]" == "not found"
jsonpath "$[?count($.*) == 1]" exists

# Cleanup
DELETE {{host}}/api/articles/{{slug}}
Authorization: Token {{token}}
HTTP 204
