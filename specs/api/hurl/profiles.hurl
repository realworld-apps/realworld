# Register main user
POST {{host}}/api/users
{
  "user": {
    "username": "prof_{{uid}}",
    "email": "prof_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
token: jsonpath "$.user.token"

# Register celeb user
POST {{host}}/api/users
{
  "user": {
    "username": "celeb_{{uid}}",
    "email": "celeb_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201

# Get profile without auth
GET {{host}}/api/profiles/celeb_{{uid}}
HTTP 200
[Asserts]
jsonpath "$.profile.username" == "celeb_{{uid}}"
jsonpath "$.profile.bio" == null
jsonpath "$.profile.image" == null
jsonpath "$.profile.following" == false
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.profile.*" count == 4

# Get profile with auth
GET {{host}}/api/profiles/celeb_{{uid}}
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.profile.username" == "celeb_{{uid}}"
jsonpath "$.profile.bio" == null
jsonpath "$.profile.image" == null
jsonpath "$.profile.following" == false
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.profile.*" count == 4

# Follow profile
POST {{host}}/api/profiles/celeb_{{uid}}/follow
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.profile.username" == "celeb_{{uid}}"
jsonpath "$.profile.bio" == null
jsonpath "$.profile.image" == null
jsonpath "$.profile.following" == true
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.profile.*" count == 4

# Unfollow profile
DELETE {{host}}/api/profiles/celeb_{{uid}}/follow
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.profile.username" == "celeb_{{uid}}"
jsonpath "$.profile.bio" == null
jsonpath "$.profile.image" == null
jsonpath "$.profile.following" == false
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.profile.*" count == 4

# Verify unfollow persisted
GET {{host}}/api/profiles/celeb_{{uid}}
Authorization: Token {{token}}
HTTP 200
[Asserts]
jsonpath "$.profile.username" == "celeb_{{uid}}"
jsonpath "$.profile.bio" == null
jsonpath "$.profile.image" == null
jsonpath "$.profile.following" == false
jsonpath "$[?count($.*) == 1]" exists
jsonpath "$.profile.*" count == 4
