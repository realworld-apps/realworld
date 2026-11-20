# Setup: Register
POST {{host}}/api/users
{
  "user": {
    "username": "tag_{{uid}}",
    "email": "tag_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
token: jsonpath "$.user.token"

# Setup: Create article with tags
POST {{host}}/api/articles
Authorization: Token {{token}}
{
  "article": {
    "title": "Tag Article {{uid}}",
    "description": "For tags",
    "body": "Article body",
    "tagList": ["h_{{uid}}", "t_{{uid}}"]
  }
}
HTTP 201
[Captures]
slug: jsonpath "$.article.slug"

# Get tags
GET {{host}}/api/tags
HTTP 200
[Asserts]
jsonpath "$.tags" isList
jsonpath "$.tags" count >= 1
jsonpath "$.tags" contains "h_{{uid}}"
jsonpath "$.tags" contains "t_{{uid}}"
jsonpath "$.tags[0]" isString
jsonpath "$.tags[1]" isString
jsonpath "$[?count($.*) == 1]" exists

# Cleanup
DELETE {{host}}/api/articles/{{slug}}
Authorization: Token {{token}}
HTTP 204
