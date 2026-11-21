# notification-service

**Phase 2 (implemented)** · Port `8006` · Own database `worklens_notification`

Stores and serves in-app notifications.

## Public routes (through the gateway, need a login token)
`GET /api/notifications`, `POST /api/notifications`, `PATCH /api/notifications/read-all`,
`PATCH /api/notifications/:id/read`, `DELETE /api/notifications/:id`. Same behaviour as before.

## Internal routes (need the internal key; blocked by the gateway)
| Route | Purpose |
|---|---|
| `POST /internal/notifications` | Create one notification, or send an array to create many |
| `POST /internal/notifications/delete-many` | `{}` or `{ userId }`, used by the seed scripts |

## How the backend talks to it (no controller was changed)
The backend creates notifications in 14 places across 11 files (leave, assignments, online classes, HOD, duty allocation...).
Instead of editing each of them, `backend/shared/models/Notification.js` was replaced by a small client with the same
`create`, `insertMany` and `deleteMany` calls. Each call now becomes an HTTP request to this service.

- It never throws: if this service is down or slower than 2.5 s, a warning is logged and the original request (for example
  approving a leave) still succeeds. Only the notification is lost.
- Any other old method (`find`, `countDocuments`...) throws a clear error, so old code cannot silently misbehave.
- The internal key is derived from `JWT_SECRET`, so there is nothing extra to configure.

## Moving the existing notifications (optional)
New notifications go to `worklens_notification`. Old ones stay in the backend's database and are no longer shown.
To copy them over once (the old data is only read):
```bash
cd services/notification-service
OLD_MONGO_URI="<backend's MONGO_URI>" npm run migrate      # destination is MONGO_URI from .env
```

## Run
```bash
cd services/notification-service
cp .env.example .env
npm install
npm run dev
```

## Env
```env
PORT=8006
MONGO_URI=<same cluster as the backend, database name worklens_notification>
JWT_SECRET=<same as everywhere>
```
