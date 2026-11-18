# academic-service

**Phase 4** · Port `8002` · DB `worklens_academic`

Everything a faculty member does with courses: teaching, attendance, assessment and materials.

## Public routes
`/api/courses`, `/api/attendance`, `/api/assignments`, `/api/syllabus`, `/api/timetable`,
`/api/lesson-plans`, `/api/study-materials`, `/api/online-classes`, `/api/dashboard`,
`/api/activity-logs`, `/api/duties` (faculty extra duties), `/api/workflow` (feedback submit, handled inside `dashboardController`)

## Moves here from the monolith
- Models: `Course`, `Attendance`, `Assignment`, `Syllabus`, `OnlineClass`, `ActivityLog`,
  `teaching/models/LessonPlan`, `teaching/models/StudyMaterial`, `teaching/models/ExtraDuty`
- Controllers: course, attendance, assignment, syllabus, timetable, lessonPlan, studyMaterial,
  onlineClass, extraDuty, dashboard, activityLog
- Utils: `teaching/utils/logActivity.js`
- Script: `teaching/scripts/seed.js`

Syllabus is kept here with Course because `syllabusController` uses `populate("courseId")`, which only works inside one database.

## Internal endpoints it exposes
| Endpoint | Used by |
|---|---|
| `GET /internal/courses?dept=&teacherId=` | hod-service, leave-service, ai-service |
| `GET /internal/courses/:id` | hod-service, ai-service |
| `PATCH /internal/courses/:id/allocation` | hod-service (course allocation writes `allocationId` / teacher) |
| `GET /internal/attendance/summary?dept=` | hod-service (reports, dashboard) |
| `GET /internal/assignments?courseIds=` | hod-service, leave-service |
| `GET /internal/online-classes?courseIds=&date=` | hod-service, leave-service |
| `GET /internal/syllabus/progress?dept=` | hod-service (reports) |

## Calls
- notification-service (assignments, online classes, course enrolment)
- leave-service (pending-approvals count on the dashboard)
- auth-service (user lookups)

## Env
```env
PORT=8002
MONGO_URI=mongodb://127.0.0.1:27017/worklens_academic
WORKFLOW_ANON_SECRET=
NOTIFICATION_URL=http://localhost:8006
LEAVE_URL=http://localhost:8003
AUTH_URL=http://localhost:8001
```
