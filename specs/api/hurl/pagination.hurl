# Setup: Register
POST {{host}}/api/users
{
  "user": {
    "username": "page_{{uid}}",
    "email": "page_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
token: jsonpath "$.user.token"

# Create article 1
POST {{host}}/api/articles
Authorization: Token {{token}}
{
  "article": {
    "title": "Pagination 1 {{uid}}",
    "description": "Page test 1",
    "body": "Page body 1"
  }
}
HTTP 201
[Captures]
slug1: jsonpath "$.article.slug"

# Create article 2
POST {{host}}/api/articles
Authorization: Token {{token}}
{
  "article": {
    "title": "Pagination 2 {{uid}}",
    "description": "Page test 2",
    "body": "Page body 2"
  }
}
HTTP 201
[Asserts]
jsonpath "$.article.title" == "Pagination 2 {{uid}}"
jsonpath "$.article.slug" isString
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.article.*" count == 10
jsonpath "$.article.author.*" count == 4
[Captures]
slug2: jsonpath "$.article.slug"

# List with limit=1 (most recent first, so slug2)
GET {{host}}/api/articles?author=page_{{uid}}&limit=1
HTTP 200
[Asserts]
jsonpath "$.articles" count == 1
jsonpath "$.articlesCount" == 2
jsonpath "$.articles[0].slug" == "{{slug2}}"
jsonpath "$.*" count == 2
jsonpath "$.articles[0].*" count == 9
jsonpath "$.articles[0].author.*" count == 4

# List with limit=1&offset=1 (second page, so slug1)
GET {{host}}/api/articles?author=page_{{uid}}&limit=1&offset=1
HTTP 200
[Asserts]
jsonpath "$.articles" count == 1
jsonpath "$.articlesCount" == 2
jsonpath "$.articles[0].slug" == "{{slug1}}"
jsonpath "$.*" count == 2
jsonpath "$.articles[0].*" count == 9
jsonpath "$.articles[0].author.*" count == 4

# Cleanup
DELETE {{host}}/api/articles/{{slug1}}
Authorization: Token {{token}}
HTTP 204

DELETE {{host}}/api/articles/{{slug2}}
Authorization: Token {{token}}
HTTP 204
