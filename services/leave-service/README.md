# leave-service

**Phase 4** · Port `8003` · DB `worklens_leave`

Leave applications, balances, holidays, and the HOD approval workflow.

## Public routes
- `/api/leaves/*` (faculty side)
- `/api/hod/leaves/*` (HOD side: pending, overview, history, export, calendar, balances, insights,
  `:id/impact`, `:id/approve-with-cover`). The gateway must route these **before** `/api/hod`.

## Moves here from the monolith
- Models: `shared/models/Leave.js` (`Leave`, `LeaveBalance`, `Holiday`)
- Controllers: `teaching/controller/leaveController`, `hod/controller/hodLeaveController`
- Script: `seedLeaves.js`

## Internal endpoints it exposes
| Endpoint | Used by |
|---|---|
| `GET /internal/leaves?dept=&status=&from=&to=` | hod-service (dashboard, workload, reports, availability), academic (dashboard pending count) |
| `GET /internal/leaves/on-date?date=` | hod-service (availability, substitutions) |

## Calls
- academic-service: courses, assignments and online classes affected by a leave (`:id/impact`)
- notification-service: leave submitted / approved / rejected
- auth-service: faculty names and departments

## Env
```env
PORT=8003
MONGO_URI=mongodb://127.0.0.1:27017/worklens_leave
ACADEMIC_URL=http://localhost:8002
NOTIFICATION_URL=http://localhost:8006
AUTH_URL=http://localhost:8001
```
