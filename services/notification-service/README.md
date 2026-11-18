# notification-service

**Phase 2** · Port `8006` · DB `worklens_notification`

Stores and serves in-app notifications. Today ~10 controllers create `Notification` documents directly.

## Public routes
- `GET /api/notifications`, mark-as-read, mark-all-read (same endpoints as `notificationController`)

## Moves here from the monolith
- Model: `shared/models/Notification.js`
- Controller: `shared/controller/notificationController.js`
- Script: `seedNotifications.js`

## Internal endpoints it exposes
| Endpoint | Purpose |
|---|---|
| `POST /internal/notifications` | Create one notification `{ userId, title, message, type, ... }` |
| `POST /internal/notifications/bulk` | Create many (for example all students of a course) |

## Callers to change (replace `Notification.create(...)` with the internal call)
`courseController`, `assignmentController`, `onlineClassController`, `leaveController`,
`hodController`, `hodLeaveController`, `dutyAllocationController`, `courseAllocationService`,
`workflowInsightsController`

Calls must be **fire-and-forget**: if this service is down, the main request still succeeds.

## Env
```env
PORT=8006
MONGO_URI=mongodb://127.0.0.1:27017/worklens_notification
```
