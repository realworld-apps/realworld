# Register empty username
POST {{host}}/api/users
{
  "user": {
    "username": "",
    "email": "ea_blank_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 422
[Asserts]
jsonpath "$.errors.username[0]" == "can't be blank"

# Register empty email
POST {{host}}/api/users
{
  "user": {
    "username": "ea_blank_{{uid}}",
    "email": "",
    "password": "password123"
  }
}
HTTP 422
[Asserts]
jsonpath "$.errors.email[0]" == "can't be blank"

# Register empty password
POST {{host}}/api/users
{
  "user": {
    "username": "ea_blankp_{{uid}}",
    "email": "ea_blankp_{{uid}}@test.com",
    "password": ""
  }
}
HTTP 422
[Asserts]
jsonpath "$.errors.password[0]" == "can't be blank"

# Register malformed email
POST {{host}}/api/users
{
  "user": {
    "username": "ea_badmail_{{uid}}",
    "email": "ea_badmail_{{uid}}_not_an_email",
    "password": "password123"
  }
}
HTTP 422
[Asserts]
jsonpath "$.errors.email[0]" == "is invalid"

# Register valid user for duplicate and login tests
POST {{host}}/api/users
{
  "user": {
    "username": "ea_dup_{{uid}}",
    "email": "ea_dup_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
token: jsonpath "$.user.token"

# Register duplicate username
POST {{host}}/api/users
{
  "user": {
    "username": "ea_dup_{{uid}}",
    "email": "ea_dup2_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 409
[Asserts]
jsonpath "$.errors.username[0]" == "has already been taken"

# Register duplicate email
POST {{host}}/api/users
{
  "user": {
    "username": "ea_dup2_{{uid}}",
    "email": "ea_dup_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 409
[Asserts]
jsonpath "$.errors.email[0]" == "has already been taken"

# Login empty email
POST {{host}}/api/users/login
{
  "user": {
    "email": "",
    "password": "password123"
  }
}
HTTP 422
[Asserts]
jsonpath "$.errors.email[0]" == "can't be blank"

# Login empty password
POST {{host}}/api/users/login
{
  "user": {
    "email": "ea_dup_{{uid}}@test.com",
    "password": ""
  }
}
HTTP 422
[Asserts]
jsonpath "$.errors.password[0]" == "can't be blank"

# Login malformed email
POST {{host}}/api/users/login
{
  "user": {
    "email": "ea_dup_{{uid}}@",
    "password": "password123"
  }
}
HTTP 422
[Asserts]
jsonpath "$.errors.email[0]" == "is invalid"

# Login wrong password
POST {{host}}/api/users/login
{
  "user": {
    "email": "ea_dup_{{uid}}@test.com",
    "password": "wrongpassword"
  }
}
HTTP 401
[Asserts]
jsonpath "$.errors.credentials[0]" == "invalid"

# GET /user no auth
GET {{host}}/api/user
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is missing"

# PUT /user no auth
PUT {{host}}/api/user
{
  "user": {
    "bio": "test"
  }
}
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is missing"

# Update email to empty string - should reject
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "email": ""
  }
}
HTTP 422

# Update email to malformed value - should reject
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "email": "not-an-email"
  }
}
HTTP 422
[Asserts]
jsonpath "$.errors.email[0]" == "is invalid"

# Update username to empty string - should reject
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "username": ""
  }
}
HTTP 422

# Update email to null - should reject
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "email": null
  }
}
HTTP 422

# Update username to null - should reject
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "username": null
  }
}
HTTP 422

# === NIST 800-63B password policy for PUT /user ===
# Ref: https://pages.nist.gov/800-63-3/sp800-63b.html section 5.1.1.2
# Rules: min 8 chars, must accept at least 64 chars, no composition, no breach check (demo)

# Update password to empty string - should reject
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "password": ""
  }
}
HTTP 422

# Update password to null - should reject
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "password": null
  }
}
HTTP 422

# Update password shorter than 8 chars - should reject
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "password": "short7c"
  }
}
HTTP 422

# Update password to 8 char simple word - should accept
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "password": "bonjour1"
  }
}
HTTP 200

# Update password to 64 chars - should accept
PUT {{host}}/api/user
Authorization: Token {{token}}
{
  "user": {
    "password": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
HTTP 200
