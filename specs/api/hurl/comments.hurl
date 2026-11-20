# Setup: Register
POST {{host}}/api/users
{
  "user": {
    "username": "cmt_{{uid}}",
    "email": "cmt_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
token: jsonpath "$.user.token"

# Setup: Create article
POST {{host}}/api/articles
Authorization: Token {{token}}
{
  "article": {
    "title": "Comment Article {{uid}}",
    "description": "For comments",
    "body": "Article body"
  }
}
HTTP 201
[Captures]
slug: jsonpath "$.article.slug"

# Create comment
POST {{host}}/api/articles/{{slug}}/comments
Authorization: Token {{token}}
{
  "comment": {
    "body": "Test comment body"
  }
}
HTTP 201
[Asserts]
jsonpath "$.comment.id" isInteger
jsonpath "$.comment.body" == "Test comment body"
jsonpath "$.comment.createdAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.comment.updatedAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.comment.author.username" == "cmt_{{uid}}"
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.comment.*" count == 5
jsonpath "$.comment.author.*" count == 4
[Captures]
comment_id: jsonpath "$.comment.id"

# List comments
GET {{host}}/api/articles/{{slug}}/comments
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.comments" isList
jsonpath "$.comments" count == 1
jsonpath "$.comments[0].id" == {{comment_id}}
jsonpath "$.comments[0].body" == "Test comment body"
jsonpath "$.comments[0].createdAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.comments[0].updatedAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.comments[0].author.username" == "cmt_{{uid}}"
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.comments[0].*" count == 5
jsonpath "$.comments[0].author.*" count == 4

# List comments without auth
GET {{host}}/api/articles/{{slug}}/comments
HTTP 200
[Asserts]
jsonpath "$.comments" isList
jsonpath "$.comments" count == 1
jsonpath "$.comments[0].id" isInteger
jsonpath "$.comments[0].body" == "Test comment body"
jsonpath "$.comments[0].createdAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.comments[0].updatedAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.comments[0].author.username" == "cmt_{{uid}}"
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.comments[0].*" count == 5
jsonpath "$.comments[0].author.*" count == 4

# Delete comment
DELETE {{host}}/api/articles/{{slug}}/comments/{{comment_id}}
Authorization: Token {{token}}
HTTP 204

# Verify deletion
GET {{host}}/api/articles/{{slug}}/comments
HTTP 200
[Asserts]
jsonpath "$.comments" count == 0
jsonpath "$[?count($.*) == 1]" exists

# Selective deletion: create two comments, delete one, verify the other remains
POST {{host}}/api/articles/{{slug}}/comments
Authorization: Token {{token}}
{
  "comment": {
    "body": "First comment"
  }
}
HTTP 201
[Captures]
first_comment_id: jsonpath "$.comment.id"

POST {{host}}/api/articles/{{slug}}/comments
Authorization: Token {{token}}
{
  "comment": {
    "body": "Second comment"
  }
}
HTTP 201

# Verify two comments exist
GET {{host}}/api/articles/{{slug}}/comments
HTTP 200
[Asserts]
jsonpath "$.comments" count == 2
jsonpath "$[?count($.*) == 1]" exists

# Delete the first comment
DELETE {{host}}/api/articles/{{slug}}/comments/{{first_comment_id}}
Authorization: Token {{token}}
HTTP 204

# Verify only the second comment remains
GET {{host}}/api/articles/{{slug}}/comments
HTTP 200
[Asserts]
jsonpath "$.comments" count == 1
jsonpath "$.comments[0].body" == "Second comment"
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.comments[0].*" count == 5
jsonpath "$.comments[0].author.*" count == 4

# Cleanup
DELETE {{host}}/api/articles/{{slug}}
Authorization: Token {{token}}
HTTP 204
