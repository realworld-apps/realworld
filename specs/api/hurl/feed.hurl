# Register main user
POST {{host}}/api/users
{
  "user": {
    "username": "feedm_{{uid}}",
    "email": "feedm_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
main_token: jsonpath "$.user.token"

# Register celeb user
POST {{host}}/api/users
{
  "user": {
    "username": "feedc_{{uid}}",
    "email": "feedc_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
celeb_token: jsonpath "$.user.token"

# Feed for new user returns empty
GET {{host}}/api/articles/feed
Authorization: Token {{main_token}}
HTTP 200
[Asserts]
jsonpath "$.articlesCount" == 0
jsonpath "$.articles" count == 0
jsonpath "$.*" count == 2

# Main follows celeb
POST {{host}}/api/profiles/feedc_{{uid}}/follow
Authorization: Token {{main_token}}
HTTP 200
[Asserts]
jsonpath "$.profile.following" == true
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.profile.*" count == 4

# Celeb creates article 1
POST {{host}}/api/articles
Authorization: Token {{celeb_token}}
{
  "article": {
    "title": "Feed Article 1 {{uid}}",
    "description": "Feed test 1",
    "body": "Feed body 1"
  }
}
HTTP 201
[Captures]
slug1: jsonpath "$.article.slug"

# Celeb creates article 2
POST {{host}}/api/articles
Authorization: Token {{celeb_token}}
{
  "article": {
    "title": "Feed Article 2 {{uid}}",
    "description": "Feed test 2",
    "body": "Feed body 2"
  }
}
HTTP 201
[Captures]
slug2: jsonpath "$.article.slug"

# Main checks feed
GET {{host}}/api/articles/feed
Authorization: Token {{main_token}}
HTTP 200
[Asserts]
jsonpath "$.articles" isList
jsonpath "$.articlesCount" isInteger
jsonpath "$.articlesCount" == 2
jsonpath "$.articles" count == 2
jsonpath "$.articles[0].title" isString
jsonpath "$.articles[0].slug" isString
jsonpath "$.articles[0].description" isString
jsonpath "$.articles[0].body" not exists
jsonpath "$.articles[0].tagList" isList
jsonpath "$.articles[0].createdAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.articles[0].updatedAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.articles[0].favorited" isBoolean
jsonpath "$.articles[0].favoritesCount" isInteger
jsonpath "$.articles[0].author.username" == "feedc_{{uid}}"
jsonpath "$.*" count == 2
jsonpath "$.articles[0].*" count == 9
jsonpath "$.articles[0].author.*" count == 4

# Feed with limit=1
GET {{host}}/api/articles/feed?limit=1
Authorization: Token {{main_token}}
HTTP 200
[Asserts]
jsonpath "$.articles" count == 1
jsonpath "$.articlesCount" == 2
jsonpath "$.articles[0].title" isString
jsonpath "$.articles[0].slug" isString
jsonpath "$.articles[0].description" isString
jsonpath "$.articles[0].body" not exists
jsonpath "$.articles[0].tagList" isList
jsonpath "$.articles[0].createdAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.articles[0].updatedAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.articles[0].favorited" isBoolean
jsonpath "$.articles[0].favoritesCount" isInteger
jsonpath "$.articles[0].author.username" == "feedc_{{uid}}"
jsonpath "$.articles[0].author.following" == true
jsonpath "$.*" count == 2
jsonpath "$.articles[0].*" count == 9
jsonpath "$.articles[0].author.*" count == 4

# Feed with limit=1&offset=1
GET {{host}}/api/articles/feed?limit=1&offset=1
Authorization: Token {{main_token}}
HTTP 200
[Asserts]
jsonpath "$.articles" count == 1
jsonpath "$.articlesCount" == 2
jsonpath "$.*" count == 2

# Cleanup: delete articles
DELETE {{host}}/api/articles/{{slug1}}
Authorization: Token {{celeb_token}}
HTTP 204

DELETE {{host}}/api/articles/{{slug2}}
Authorization: Token {{celeb_token}}
HTTP 204

# Cleanup: unfollow
DELETE {{host}}/api/profiles/feedc_{{uid}}/follow
Authorization: Token {{main_token}}
HTTP 200
