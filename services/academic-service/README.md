# academic-service (Phase 4)

Courses, attendance, assignments, syllabus, timetable, lesson plans, study materials, online classes, extra duties, the faculty
dashboard, activity logs and the workflow-feedback endpoint. Port **8002**.

| Prefix | |
|---|---|
| `/api/courses`, `/api/attendance`, `/api/assignments`, `/api/syllabus`, `/api/timetable` | |
| `/api/lesson-plans`, `/api/study-materials`, `/api/online-classes`, `/api/duties` | |
| `/api/dashboard`, `/api/workflow`, `/api/activity-logs` | |

(`/api/ai` stays in ai-service, which fetches the course through the courses API.)

## Database
Uses the **same database as the backend** (same `MONGO_URI`). Nothing is copied or migrated; the HOD module in the backend still
reads Course, Attendance, Assignment and OnlineClass directly, so both must see the same records. Own `worklens_academic`
database in Phase 5. The dashboard also reads the `leaves` collection (read-only copy of the `Leave` model), which becomes a call to
leave-service in Phase 5.

## Dependencies
- Users: auth-service `/internal/users` (30 s cache; 503 if auth-service is down and the user is not cached).
- Notifications: notification-service, fire-and-forget.
- `WORKFLOW_ANON_SECRET`: same value as `backend/.env`.

## Run
```
cd services/academic-service
copy .env.example .env      # same MONGO_URI, JWT_SECRET and WORKFLOW_ANON_SECRET as backend/.env
npm install
npm run dev
```
Then `ACADEMIC_URL=http://localhost:8002` in `gateway/.env` and restart the gateway. **Rollback:** delete that line and restart the gateway.
