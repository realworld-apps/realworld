# Register user A
POST {{host}}/api/users
{
  "user": {
    "username": "authz_a_{{uid}}",
    "email": "authz_a_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
token_a: jsonpath "$.user.token"

# Register user B
POST {{host}}/api/users
{
  "user": {
    "username": "authz_b_{{uid}}",
    "email": "authz_b_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
token_b: jsonpath "$.user.token"

# User A creates article
POST {{host}}/api/articles
Authorization: Token {{token_a}}
{
  "article": {
    "title": "Authz Article {{uid}}",
    "description": "test",
    "body": "test"
  }
}
HTTP 201
[Captures]
slug: jsonpath "$.article.slug"

# User B tries to delete -> 403
DELETE {{host}}/api/articles/{{slug}}
Authorization: Token {{token_b}}
HTTP 403
[Asserts]
jsonpath "$.errors.article[0]" == "forbidden"
jsonpath "$[?count($.*) == 1]" exists

# User B tries to update -> 403
PUT {{host}}/api/articles/{{slug}}
Authorization: Token {{token_b}}
{
  "article": {
    "body": "hijacked"
  }
}
HTTP 403
[Asserts]
jsonpath "$.errors.article[0]" == "forbidden"
jsonpath "$[?count($.*) == 1]" exists

# User A creates a comment on the article
POST {{host}}/api/articles/{{slug}}/comments
Authorization: Token {{token_a}}
{
  "comment": {
    "body": "A's comment"
  }
}
HTTP 201
[Captures]
comment_id: jsonpath "$.comment.id"

# User B tries to delete A's comment -> 403
DELETE {{host}}/api/articles/{{slug}}/comments/{{comment_id}}
Authorization: Token {{token_b}}
HTTP 403
[Asserts]
jsonpath "$.errors.comment[0]" == "forbidden"
jsonpath "$[?count($.*) == 1]" exists

# Verify comment survived the failed delete
GET {{host}}/api/articles/{{slug}}/comments
HTTP 200
[Asserts]
jsonpath "$.comments" count >= 1
jsonpath "$.comments[0].body" == "A's comment"
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.comments[0].*" count == 5
jsonpath "$.comments[0].author.*" count == 4

# Cleanup: User A deletes article
DELETE {{host}}/api/articles/{{slug}}
Authorization: Token {{token_a}}
HTTP 204
