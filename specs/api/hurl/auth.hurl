# Register
POST {{host}}/api/users
{
  "user": {
    "username": "auth_{{uid}}",
    "email": "auth_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Asserts]
jsonpath "$.user.username" == "auth_{{uid}}"
jsonpath "$.user.email" == "auth_{{uid}}@test.com"
jsonpath "$.user.bio" == null
jsonpath "$.user.image" == null
jsonpath "$.user.token" isString
jsonpath "$.user.token" not isEmpty
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5
[Captures]
reg_token: jsonpath "$.user.token"

# Login
POST {{host}}/api/users/login
{
  "user": {
    "email": "auth_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 200
[Asserts]
jsonpath "$.user.username" == "auth_{{uid}}"
jsonpath "$.user.email" == "auth_{{uid}}@test.com"
jsonpath "$.user.bio" == null
jsonpath "$.user.image" == null
jsonpath "$.user.token" isString
jsonpath "$.user.token" not isEmpty
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5
[Captures]
token: jsonpath "$.user.token"

# Get current user
GET {{host}}/api/user
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.user.username" == "auth_{{uid}}"
jsonpath "$.user.email" == "auth_{{uid}}@test.com"
jsonpath "$.user.bio" == null
jsonpath "$.user.image" == null
jsonpath "$.user.token" isString
jsonpath "$.user.token" not isEmpty
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Update user
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "bio": "Updated bio"
  }
}
HTTP 200
[Asserts]
jsonpath "$.user.username" == "auth_{{uid}}"
jsonpath "$.user.email" == "auth_{{uid}}@test.com"
jsonpath "$.user.bio" == "Updated bio"
jsonpath "$.user.image" == null
jsonpath "$.user.token" isString
jsonpath "$.user.token" not isEmpty
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Verify update persisted
GET {{host}}/api/user
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.user.username" == "auth_{{uid}}"
jsonpath "$.user.email" == "auth_{{uid}}@test.com"
jsonpath "$.user.bio" == "Updated bio"
jsonpath "$.user.image" == null
jsonpath "$.user.token" isString
jsonpath "$.user.token" not isEmpty
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Update user bio to empty string - should normalize to null
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "bio": ""
  }
}
HTTP 200
[Asserts]
jsonpath "$.user.bio" == null
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Verify empty string normalization persisted
GET {{host}}/api/user
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.user.bio" == null
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Restore bio then set to null
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "bio": "Temporary bio"
  }
}
HTTP 200
[Asserts]
jsonpath "$.user.bio" == "Temporary bio"
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Update user bio to null - should accept for nullable field
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "bio": null
  }
}
HTTP 200
[Asserts]
jsonpath "$.user.bio" == null
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Verify null bio persisted
GET {{host}}/api/user
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.user.bio" == null
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Restore bio
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "bio": "Updated bio"
  }
}
HTTP 200
[Asserts]
jsonpath "$.user.username" == "auth_{{uid}}"
jsonpath "$.user.email" == "auth_{{uid}}@test.com"
jsonpath "$.user.bio" == "Updated bio"
jsonpath "$.user.image" == null
jsonpath "$.user.token" isString
jsonpath "$.user.token" not isEmpty
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Update user image
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "image": "https://example.com/photo.jpg"
  }
}
HTTP 200
[Asserts]
jsonpath "$.user.image" == "https://example.com/photo.jpg"
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Verify image update persisted
GET {{host}}/api/user
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.user.image" == "https://example.com/photo.jpg"
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Update image to empty string - should normalize to null
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "image": ""
  }
}
HTTP 200
[Asserts]
jsonpath "$.user.image" == null
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Verify image empty string normalization persisted
GET {{host}}/api/user
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.user.image" == null
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Set image then update to null - should accept for nullable field
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "image": "https://example.com/temp.jpg"
  }
}
HTTP 200
[Asserts]
jsonpath "$.user.image" == "https://example.com/temp.jpg"
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "image": null
  }
}
HTTP 200
[Asserts]
jsonpath "$.user.image" == null
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Verify null image persisted
GET {{host}}/api/user
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.user.image" == null
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5

# Update username and email
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "username": "auth_{{uid}}_upd",
    "email": "auth_{{uid}}_upd@test.com"
  }
}
HTTP 200
[Asserts]
jsonpath "$.user.username" == "auth_{{uid}}_upd"
jsonpath "$.user.email" == "auth_{{uid}}_upd@test.com"
jsonpath "$.user.bio" == "Updated bio"
jsonpath "$.user.image" == null
jsonpath "$.user.token" isString
jsonpath "$.user.token" not isEmpty
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5
[Captures]
updated_token: jsonpath "$.user.token"

# Verify username/email update persisted
GET {{host}}/api/user
Authorization: Token {{updated_token}}
HTTP 200
[Asserts]
jsonpath "$.user.username" == "auth_{{uid}}_upd"
jsonpath "$.user.email" == "auth_{{uid}}_upd@test.com"
jsonpath "$.user.bio" == "Updated bio"
jsonpath "$.user.image" == null
jsonpath "$.user.token" isString
jsonpath "$.user.token" not isEmpty
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.user.*" count == 5
