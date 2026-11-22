# leave-service (Phase 4)

Leave applications, balances, monthly stats, holidays and HOD approval. Port **8003**.

| Path | What |
|---|---|
| `GET/POST /api/leaves`, `DELETE /api/leaves/:id` | faculty apply, list, cancel |
| `PATCH /api/leaves/:id/status` | HOD approves or rejects (own department's teaching staff only) |
| `GET /api/leaves/balance`, `/monthly`, `/holidays` | stats and holiday calendar |
| `/health` | liveness |

`/api/hod/leaves/*` (overview, history, calendar, insights, approve-with-cover...) is **not** here: it needs HOD data and moves with
the HOD module in Phase 5.

## Database
Uses the **same database as the backend** (same `MONGO_URI`). Nothing is copied or migrated, so the live backend and this service
always see the same leaves. It gets its own `worklens_leave` database in Phase 5.

## Dependencies
- Users: auth-service `/internal/users` (30 s cache; 503 if auth-service is down and the user is not cached).
- Notifications: notification-service, fire-and-forget (a leave decision still saves if it is down).
- Login token: same `JWT_SECRET` as the backend and gateway.

## Run
```
cd services/leave-service
copy .env.example .env      # same MONGO_URI and JWT_SECRET as backend/.env
npm install
npm run dev
```
Then `LEAVE_URL=http://localhost:8003` in `gateway/.env` and restart the gateway. **Rollback:** delete that line and restart the gateway.
