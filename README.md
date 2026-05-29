# WorkLens Edu — Complete Faculty Management System

A full-stack faculty management web application with Login, Analytics, Settings, Courses, Assignments, Attendance, Leave Management, and more.

---

## 🗂️ Project Structure

```
WorkLens-Complete/
├── frontend/          # React + Vite frontend
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.jsx          ← NEW
│       │   ├── AnalyticsPage.jsx      ← NEW
│       │   ├── SettingsPage.jsx       ← NEW
│       │   ├── CoursesPage.jsx        ← REWRITTEN (full DB sync)
│       │   ├── AssignmentsPage.jsx    ← REWRITTEN (full DB sync)
│       │   ├── Dashboard.jsx
│       │   ├── Attendance.jsx
│       │   ├── LeaveManagement.jsx
│       │   ├── WorkflowReview.jsx
│       │   ├── ActivityLogs.jsx
│       │   ├── ExtraDutiesPage.jsx
│       │   └── StudentProfile.jsx
│       ├── components/
│       │   ├── Sidebar.jsx            ← UPDATED (Analytics, Settings links + logout)
│       │   ├── Topbar.jsx             ← UPDATED (shows logged-in user)
│       │   └── UI.jsx                 ← UPDATED (theme-aware components)
│       ├── ThemeContext.jsx            ← NEW (dark/light mode)
│       └── services/api.js            ← UPDATED (all endpoints)
│
└── backend/           # Node.js + Express + MongoDB
    ├── models/
    │   ├── User.js         ← NEW
    │   ├── Analytics.js    ← NEW
    │   ├── Assignment.js   ← UPDATED
    │   └── course.js       ← UPDATED
    ├── controller/
    │   ├── authController.js       ← NEW
    │   ├── settingsController.js   ← NEW
    │   ├── analyticsController.js  ← NEW
    │   ├── assignmentController.js ← UPDATED
    │   └── courseController.js     ← UPDATED
    ├── routes/
    │   ├── authRoutes.js       ← NEW
    │   ├── settingsRoutes.js   ← NEW
    │   └── analyticsRoutes.js  ← NEW
    ├── scripts/
    │   └── seedUsers.js        ← NEW
    └── server.js               ← UPDATED
```

---

## 🚀 Setup & Run

### 1. Backend Setup
```bash
cd backend
npm install          # Installs bcryptjs + all deps
cp .env.example .env # Set MONGO_URI=your_mongodb_uri

npm run seed         # Seed courses, attendance etc.
npm run seed:users   # Seed demo user accounts
npm run dev          # Start backend on http://localhost:8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install          # Installs recharts, react-router-dom + all deps
npm run dev          # Start frontend on http://localhost:5173
```

---

## 🔐 Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Teaching Staff | teaching@gmail.com | 123456 |
| Non-Teaching Staff | staff@gmail.com | 123456 |
| Admin | admin@gmail.com | admin123 |

---

## ✅ What's New / Fixed

### New Pages
- **Login Page** — Role-based login (Teaching / Non-Teaching / Admin), connects to `/api/auth/login`
- **Analytics Page** — Live charts from DB (bar, line, pie), course performance table, insights
- **Settings Page** — Edit profile, notification toggles, dark/light mode toggle — saves to DB

### Fixed Pages
- **Courses Page** — All data from DB (`/api/courses`), shows student count, schedule, progress from assignments
- **Assignments Page** — Full CRUD: create (with course dropdown from DB), delete, view pending/submitted students, send reminder

### Backend
- **Auth** — `POST /api/auth/login` with bcrypt password check
- **Settings** — `GET/PUT /api/settings/:userId` — save profile & notification preferences
- **Analytics** — `GET /api/analytics?role=teaching` — live data from courses, assignments, attendance
- **Assignments** — `DELETE /api/assignments/:id`, `PUT /api/assignments/:id`
- **Courses** — Returns `courseName`, `courseCode`, `sem`, `schedule`, `progress` (computed from assignments)

### UI
- **Sidebar** — Analytics & Settings links added, working logout with confirmation modal
- **Topbar** — Shows logged-in user's name and department
- **Dark/Light Mode** — Theme toggle in Settings persists via React Context
