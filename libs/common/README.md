# libs/common

Small helpers shared by several services, so the same code is not copy-pasted.
Keep this package tiny: **no models and no business logic**.

## Planned contents
| File | Purpose |
|---|---|
| `identity.js` | Express middleware that reads `x-user-id`, `x-user-role`, `x-user-dept` into `req.user`; `requireRole(...roles)` |
| `internalClient.js` | Axios/fetch wrapper for service-to-service calls (timeout, retry once, forwards identity headers) |
| `notify.js` | `notify(userId, payload)`: fire-and-forget call to notification-service that never throws |
| `facultyProfile.js` | `missingFields` / `isComplete` (used by auth-service and hod-service) |

Each service installs it with `"@worklens/common": "file:../../libs/common"` in its `package.json`.
