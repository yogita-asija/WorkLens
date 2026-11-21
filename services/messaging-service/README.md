# messaging-service (Phase 3)

HOD ↔ faculty chat, announcements, faculty "student messages" and the real-time Socket.IO layer. Port **8005**, own database **`worklens_messaging`**.

REST and sockets live in the same process on purpose: the REST controllers push live events (`dm:new`, `dm:read`, …) through the in-memory Socket.IO rooms, so they have to move together.

| Path | What |
|---|---|
| `/api/dept-messages/*` | contacts, threads, send/edit/delete, read state, stats, announcements |
| `/api/messages/*` | student messages |
| `/socket.io` | WebSocket + polling (token in the handshake `auth.token`) |
| `/health` | liveness |

## Where its dependencies come from
- **Users** → auth-service `/internal/users` (cached 30 s, `USER_CACHE_TTL_MS`). If auth-service is down, uncached users get **503** (users already cached keep working).
- **Notifications** → notification-service `/internal/notifications`, fire-and-forget. If it is down the chat still works and a warning is logged.
- **Login token** → same `JWT_SECRET` as the backend and gateway.

## Run
```
cd services/messaging-service
copy .env.example .env      # set MONGO_URI (…/worklens_messaging) and JWT_SECRET
npm install
npm run dev
```

## Moving the existing chat data (do this BEFORE switching the gateway)
```
set OLD_MONGO_URI=<the backend's MONGO_URI>
npm run migrate
```
Copies `deptconversations`, `deptmessages`, `deptannouncements`, `messages`. The old database is only read. Safe to re-run (copies only what is missing). It refuses to run if the new database was already used by the service, because new conversations would clash with the old ones.

Then in `gateway/.env` set `MESSAGING_URL=http://localhost:8005` and restart the gateway. **Rollback:** remove that line and restart the gateway; the monolith still has all its chat code and data.

## Known limits
- Rate limiter is in memory (per process). Run one instance, or move it to Redis.
- Socket.IO rooms are in memory too: more than one instance needs the Redis adapter.
- Presence/typing exist only while the process runs.
