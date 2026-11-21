# auth-service

**Phase 2 (implemented)** · Port `8001` · Database: the `users` collection (shared for now, see below)

Login, "who am I", and each user's own settings.

## Public routes (through the gateway)
| Route | Notes |
|---|---|
| `POST /api/auth/login` | Only public route. Per client lockout: 5 failed logins per email + IP locks for 15 minutes |
| `GET /api/auth/me` | Validates a stored token and returns the user |
| `GET /api/settings/:userId`, `PUT /api/settings/:userId` | Same behaviour as before |

## Internal routes (other services only, need the internal key; blocked by the gateway)
| Route | Purpose |
|---|---|
| `GET /internal/users/:id` | One user, without the password |
| `GET /internal/users?dept=&role=&ids=a,b` | Users by department (case- and space-insensitive), role (one, or comma-separated list) or ids. At least one filter required; max 1000 rows |

Nothing calls these yet. They are ready for the leave, messaging and HOD services, which currently read `users` directly.

## What changed
- The login token now carries the department: `{ sub, role, dept }`. The gateway forwards it as `x-user-dept`.
- `trust proxy` is on, so the lockout uses the real client IP from the gateway.
- Moved from `backend/shared/controller/` (`authController`, `settingsController`) with the same behaviour.

## What stayed in the backend, and why
- **`/api/faculty-profile`**: its `FacultyProfile` model is defined in the HOD course-allocation model file and read by the
  allocation engine, so it moves together with the HOD portal.
- **The `users` collection**: the backend's HOD, leave and chat code still reads it directly (14 files). Giving auth-service
  a separate database now would break all of them. So auth-service uses the **same database** as the backend. Once those
  modules call `/internal/users` instead, the collection moves to its own `worklens_auth` database.

## Run
```bash
cd services/auth-service
cp .env.example .env     # same MONGO_URI and JWT_SECRET as backend/.env
npm install
npm run dev
```

## Env
```env
PORT=8001
MONGO_URI=<same database as backend/.env>
JWT_SECRET=<same as backend/.env and gateway/.env>
JWT_EXPIRES_IN=8h
```
