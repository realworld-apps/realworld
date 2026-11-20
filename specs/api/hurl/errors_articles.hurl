# Create article no auth
POST {{host}}/api/articles
{
  "article": {
    "title": "No Auth Article",
    "description": "test",
    "body": "test"
  }
}
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is missing"
jsonpath "$[?count($.*) == 1]" exists

# GET unknown slug
GET {{host}}/api/articles/unknown-slug-{{uid}}
HTTP 404
[Asserts]
jsonpath "$.errors.article[0]" == "not found"
jsonpath "$[?count($.*) == 1]" exists

# Update no auth
PUT {{host}}/api/articles/some-slug
{
  "article": {
    "body": "test"
  }
}
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is missing"
jsonpath "$[?count($.*) == 1]" exists

# Delete no auth
DELETE {{host}}/api/articles/some-slug
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is missing"
jsonpath "$[?count($.*) == 1]" exists

# GET feed no auth
GET {{host}}/api/articles/feed
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is missing"
jsonpath "$[?count($.*) == 1]" exists

# Favorite no auth
POST {{host}}/api/articles/some-slug/favorite
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is missing"
jsonpath "$[?count($.*) == 1]" exists

# Unfavorite no auth
DELETE {{host}}/api/articles/some-slug/favorite
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is missing"
jsonpath "$[?count($.*) == 1]" exists

# Setup: Register for authenticated error tests
POST {{host}}/api/users
{
  "user": {
    "username": "ea_art_{{uid}}",
    "email": "ea_art_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
token: jsonpath "$.user.token"

# Create article empty title
POST {{host}}/api/articles
Authorization: Token {{token}}
{
  "article": {
    "title": "",
    "description": "test",
    "body": "test"
  }
}
HTTP 422
[Asserts]
jsonpath "$.errors.title[0]" == "can't be blank"
jsonpath "$[?count($.*) == 1]" exists

# Create article empty description
POST {{host}}/api/articles
Authorization: Token {{token}}
{
  "article": {
    "title": "Err Desc {{uid}}",
    "description": "",
    "body": "test"
  }
}
HTTP 422
[Asserts]
jsonpath "$.errors.description[0]" == "can't be blank"
jsonpath "$[?count($.*) == 1]" exists

# Create article empty body
POST {{host}}/api/articles
Authorization: Token {{token}}
{
  "article": {
    "title": "Err Body {{uid}}",
    "description": "test",
    "body": ""
  }
}
HTTP 422
[Asserts]
jsonpath "$.errors.body[0]" == "can't be blank"
jsonpath "$[?count($.*) == 1]" exists

# Duplicate titles are allowed (each gets a unique slug)
POST {{host}}/api/articles
Authorization: Token {{token}}
{
  "article": {
    "title": "Dup Title {{uid}}",
    "description": "first",
    "body": "first"
  }
}
HTTP 201
[Captures]
slug1: jsonpath "$.article.slug"

POST {{host}}/api/articles
Authorization: Token {{token}}
{
  "article": {
    "title": "Dup Title {{uid}}",
    "description": "second",
    "body": "second"
  }
}
HTTP 201
[Captures]
slug2: jsonpath "$.article.slug"
[Asserts]
jsonpath "$.article.slug" != {{slug1}}
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.article.*" count == 10
jsonpath "$.article.author.*" count == 4

# Update unknown slug
PUT {{host}}/api/articles/unknown-slug-{{uid}}
Authorization: Token {{token}}
{
  "article": {
    "body": "test"
  }
}
HTTP 404
[Asserts]
jsonpath "$.errors.article[0]" == "not found"
jsonpath "$[?count($.*) == 1]" exists

# Favorite unknown slug
POST {{host}}/api/articles/unknown-slug-{{uid}}/favorite
Authorization: Token {{token}}
HTTP 404
[Asserts]
jsonpath "$.errors.article[0]" == "not found"
jsonpath "$[?count($.*) == 1]" exists

# Unfavorite unknown slug
DELETE {{host}}/api/articles/unknown-slug-{{uid}}/favorite
Authorization: Token {{token}}
HTTP 404
[Asserts]
jsonpath "$.errors.article[0]" == "not found"
jsonpath "$[?count($.*) == 1]" exists

# Update unknown slug
PUT {{host}}/api/articles/unknown-slug-{{uid}}
Authorization: Token {{token}}
{
  "article": {
    "body": "test"
  }
}
HTTP 404
[Asserts]
jsonpath "$.errors.article[0]" == "not found"
jsonpath "$[?count($.*) == 1]" exists

# Delete unknown slug
DELETE {{host}}/api/articles/unknown-slug-{{uid}}
Authorization: Token {{token}}
HTTP 404
[Asserts]
jsonpath "$.errors.article[0]" == "not found"
jsonpath "$[?count($.*) == 1]" exists

# Cleanup
DELETE {{host}}/api/articles/{{slug1}}
Authorization: Token {{token}}
HTTP 204

DELETE {{host}}/api/articles/{{slug2}}
Authorization: Token {{token}}
HTTP 204
