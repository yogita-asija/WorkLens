# api-gateway

**Phase 1 + 2 + 3 (implemented)** · Port `8000` · No database

The single public entry point. The React app only knows this URL (`VITE_API_URL`, unchanged).

```
browser ──► gateway :8000 ──► auth-service :8001, notification-service :8006, ai-service :8007   (Phase 2)
                         ├──► messaging-service :8005 (REST + WebSocket)                           (Phase 3)
                         └──► monolith :9000   (everything else, until it is split up)
```

## What it does
| Job | Detail |
|---|---|
| Routing | `routes.js` maps URL prefixes to services. Every service URL defaults to `MONOLITH_URL`, so Phase 1 forwards everything to the existing backend |
| CORS | Handled here (`CORS_ORIGIN`). The backend's own CORS headers are removed from responses so the browser never sees them twice |
| Token check | Verifies the JWT once; missing, invalid, forged or expired tokens get `401` before reaching any service. Only `POST /api/auth/login` is public |
| Client IP | Adds `X-Forwarded-For` so services see the real client address (the login lockout counts per client) |
| Identity headers | Forwards `x-user-id` and `x-user-role` (and `x-user-dept` once the token carries it). Copies sent by the client are always stripped first, so they cannot be forged |
| WebSocket | `/socket.io` is proxied (websocket and long-polling) for HOD to faculty chat |
| Internal endpoints | `/internal/*` always returns 404 from outside |
| Failure handling | A service that is down returns `502 {"message":"Service unavailable (...)"}` instead of hanging |
| Large bodies | No body parsing, so uploads stream through untouched (the backend allows 50 MB) |
| Health | `GET /health` lists the gateway's upstreams |

## Run it locally (without Docker)

1. Backend: in `backend/.env` set `PORT=9000` and a `JWT_SECRET` (any long random string), then `npm run dev`.
2. Gateway:
   ```bash
   cd gateway
   cp .env.example .env      # JWT_SECRET must be identical to the backend's
   npm install
   npm run dev
   ```
3. Frontend: nothing changes, `VITE_API_URL=http://localhost:8000`.

Check: `http://localhost:8000/health` shows the gateway, `http://localhost:8000/` shows the WorkLens API status from the backend.

## Route table (`routes.js`)
| Prefixes | Service | Env var that switches it |
|---|---|---|
| `/api/auth`, `/api/settings` | auth | `AUTH_URL` |
| `/api/leaves` | leave | `LEAVE_URL` (`/api/hod/leaves` stays with the HOD module until Phase 5) |
| `/api/hod`, `/api/faculty-profile` | hod | `HOD_URL` |
| `/api/dept-messages`, `/api/messages`, `/socket.io` | messaging | `MESSAGING_URL` |
| `/api/notifications` | notification | `NOTIFICATION_URL` |
| `/api/ai` | ai | `AI_URL` |
| `/api/courses`, `/api/attendance`, `/api/assignments`, `/api/syllabus`, `/api/timetable`, `/api/lesson-plans`, `/api/study-materials`, `/api/online-classes`, `/api/dashboard`, `/api/activity-logs`, `/api/duties`, `/api/workflow` | academic | `ACADEMIC_URL` |
| everything else | monolith | `MONOLITH_URL` |

To move a service out of the monolith in a later phase, set its env var in `gateway/.env`. No code change.

## Switching services on
Set `AUTH_URL`, `NOTIFICATION_URL`, `AI_URL`, `MESSAGING_URL`, `ACADEMIC_URL` and `LEAVE_URL` in `gateway/.env` (see `.env.example`). Delete a line to send that
service's routes back to the monolith, which is the quick way to roll back.

## Env (`gateway/.env`)
See `.env.example`.

## Known limits
- The backend still does its own database lookup of the user on every request, and so does auth-service. The gateway's
  token check is on top of that. The token now carries `dept` (set by auth-service), so a service that only needs the
  department can use the `x-user-dept` header instead; the backend lookup goes away as its modules are extracted.
- `JWT_SECRET` must be the same in `gateway/.env`, `backend/.env` and every service's `.env`. If one is missing or
  different, requests get 401 (or, for the backend, it generates a random secret on each start). Always set it everywhere.
