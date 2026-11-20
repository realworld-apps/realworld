# Setup: Register
POST {{host}}/api/users
{
  "user": {
    "username": "fav_{{uid}}",
    "email": "fav_{{uid}}@test.com",
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
    "title": "Favorite Article {{uid}}",
    "description": "For favorites",
    "body": "Article body"
  }
}
HTTP 201
[Captures]
slug: jsonpath "$.article.slug"

# Favorite article
POST {{host}}/api/articles/{{slug}}/favorite
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.article.title" isString
jsonpath "$.article.slug" isString
jsonpath "$.article.description" isString
jsonpath "$.article.body" isString
jsonpath "$.article.tagList" isList
jsonpath "$.article.createdAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.article.updatedAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.article.favorited" == true
jsonpath "$.article.favoritesCount" == 1
jsonpath "$.article.author.username" == "fav_{{uid}}"
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.article.*" count == 10
jsonpath "$.article.author.*" count == 4

# Verify favorite persists
GET {{host}}/api/articles/{{slug}}
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.article.title" isString
jsonpath "$.article.slug" isString
jsonpath "$.article.description" isString
jsonpath "$.article.body" isString
jsonpath "$.article.tagList" isList
jsonpath "$.article.createdAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.article.updatedAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.article.favorited" == true
jsonpath "$.article.favoritesCount" == 1
jsonpath "$.article.author.username" == "fav_{{uid}}"
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.article.*" count == 10
jsonpath "$.article.author.*" count == 4

# Articles filtered by favorited username
GET {{host}}/api/articles?favorited=fav_{{uid}}
HTTP 200
[Asserts]
jsonpath "$.articles" isList
jsonpath "$.articlesCount" isInteger
jsonpath "$.articlesCount" >= 1
jsonpath "$.articles[0].title" isString
jsonpath "$.articles[0].slug" isString
jsonpath "$.articles[0].description" isString
jsonpath "$.articles[0].body" not exists
jsonpath "$.articles[0].tagList" isList
jsonpath "$.articles[0].createdAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.articles[0].updatedAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.articles[0].favorited" isBoolean
jsonpath "$.articles[0].favoritesCount" isInteger
jsonpath "$.articles[0].favoritesCount" >= 1
jsonpath "$.*" count == 2
jsonpath "$.articles[0].*" count == 9
jsonpath "$.articles[0].author.*" count == 4

# Articles filtered by favorited username with auth
GET {{host}}/api/articles?favorited=fav_{{uid}}
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.articles" isList
jsonpath "$.articlesCount" isInteger
jsonpath "$.articlesCount" >= 1
jsonpath "$.articles[0].title" isString
jsonpath "$.articles[0].slug" isString
jsonpath "$.articles[0].description" isString
jsonpath "$.articles[0].body" not exists
jsonpath "$.articles[0].tagList" isList
jsonpath "$.articles[0].createdAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.articles[0].updatedAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.articles[0].favorited" isBoolean
jsonpath "$.articles[0].favoritesCount" isInteger
jsonpath "$.articles[0].favoritesCount" >= 1
jsonpath "$.*" count == 2
jsonpath "$.articles[0].*" count == 9
jsonpath "$.articles[0].author.*" count == 4

# Unfavorite article
DELETE {{host}}/api/articles/{{slug}}/favorite
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.article.title" isString
jsonpath "$.article.slug" isString
jsonpath "$.article.description" isString
jsonpath "$.article.body" isString
jsonpath "$.article.tagList" isList
jsonpath "$.article.createdAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.article.updatedAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.article.favorited" == false
jsonpath "$.article.favoritesCount" == 0
jsonpath "$.article.author.username" == "fav_{{uid}}"
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.article.*" count == 10
jsonpath "$.article.author.*" count == 4

# Verify unfavorite persists
GET {{host}}/api/articles/{{slug}}
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.article.title" isString
jsonpath "$.article.slug" isString
jsonpath "$.article.description" isString
jsonpath "$.article.body" isString
jsonpath "$.article.tagList" isList
jsonpath "$.article.createdAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.article.updatedAt" matches "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
jsonpath "$.article.favorited" == false
jsonpath "$.article.favoritesCount" == 0
jsonpath "$.article.author.username" == "fav_{{uid}}"
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.article.*" count == 10
jsonpath "$.article.author.*" count == 4

# Cleanup
DELETE {{host}}/api/articles/{{slug}}
Authorization: Token {{token}}
HTTP 204
