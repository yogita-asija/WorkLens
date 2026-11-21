# hod-service

**Phase 5** · Port `8004` · DB `worklens_hod`

Head-of-Department tooling: dashboard, workload, allocation, reports, and workflow insights.
This is the heaviest service because it aggregates data from every other domain.

## Public routes
`/api/hod/*` except `/api/hod/leaves/*` (that goes to leave-service), and `/api/faculty-profile` (its model
lives in the course-allocation model file, so it belongs here, not in auth-service)
(dashboard, availability, substitutions, conflicts, faculty and workload, tasks, papers, escalations,
deadlines, duty-allocation, course-allocation, reports, workflow-insights)

## Moves here from the monolith
- Models: `CourseAllocation`, `DutyAllocation`, `HodModels`, `ReportSnapshot`, `WorkflowAction`
- Controllers: `hodController`, `facultyProfileController`, `courseAllocationController`, `dutyAllocationController`,
  `hodWorkloadController`, `hodReportController`, `workflowInsightsController`
- Services/utils: `courseAllocationService`, `courseAllocationEngine`, `hodHelpers`
- Middleware: `requireHod`
- Script: `seedHod.js`

## Depends on (all through internal HTTP, never direct DB access)
| Service | Data it needs |
|---|---|
| auth-service | faculty users |
| academic-service | courses, attendance summary, assignments, online classes, syllabus progress |
| leave-service | leaves by department / date |
| notification-service | notify faculty on tasks, reminders, allocation |

## Hardest part of the migration
`hodController.js` (1343 lines) queries Course, Attendance, Assignment, OnlineClass and Leave directly.
Each query becomes one internal call, combined in the controller (API composition).

## Env
```env
PORT=8004
MONGO_URI=mongodb://127.0.0.1:27017/worklens_hod
WORKFLOW_ANON_SECRET=
DUTY_WEEKLY_CAPACITY_HOURS=40
DUTY_MAX_HOURS_PER_DAY=10
TEACHING_NORM_HOURS=16
REPORT_ATTENDANCE_MIN=75
COURSE_ALLOC_MAX_COURSES=
COURSE_ALLOC_MAX_WEEKLY_HOURS=
COURSE_ALLOC_LEAVE_BLOCK_PERCENT=
AUTH_URL=http://localhost:8001
ACADEMIC_URL=http://localhost:8002
LEAVE_URL=http://localhost:8003
NOTIFICATION_URL=http://localhost:8006
```
