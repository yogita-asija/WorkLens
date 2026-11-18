# auth-service

**Phase 2** · Port `8001` · DB `worklens_auth`

Users, login and each user's own profile and settings.

## Public routes (through the gateway)
- `POST /api/auth/login`, `GET /api/auth/me`
- `/api/settings/*`
- `/api/faculty-profile/*`

## Moves here from the monolith
- Model: `shared/models/User.js`
- Controllers: `authController`, `settingsController`, `facultyProfileController`
- Utils: `shared/utils/facultyProfile.js`
- Middleware: `signToken` from `shared/middleware/auth.js`
- Scripts: `seedUsers.js`

## Internal endpoints it exposes
| Endpoint | Used by |
|---|---|
| `GET /internal/users/:id` | messaging (department check), academic, hod |
| `GET /internal/users?dept=&role=` | hod (faculty lists), leave |
| `GET /internal/faculty-profiles?dept=` | hod course allocation |

## Change to make
Add `department` to the JWT payload: `{ sub, role, dept }`. The gateway then forwards it without a DB lookup.

## Env
```env
PORT=8001
MONGO_URI=mongodb://127.0.0.1:27017/worklens_auth
JWT_SECRET=
JWT_EXPIRES_IN=8h
```
