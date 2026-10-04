# WorkLens — Academic Intelligence & Intervention Platform

> **WorkLens is an academic intelligence platform designed to help colleges and universities monitor student activity, attendance, academics, workflows, and engagement — and turn scattered academic data into actionable insights.**

WorkLens brings students, faculty, and academic administrators into one platform with centralized academic data, dashboards, workflows, communication, and intelligent assistance.

---

## 🚀 Why WorkLens?

Educational institutions generate large amounts of student and academic data every day:

* Attendance
* Assignments
* Courses
* Syllabus progress
* Study materials
* Timetables
* Online classes
* Leaves
* Student activities
* Academic duties
* Notifications
* Faculty workflows

The problem is that this information is often distributed across different systems.

**WorkLens aims to bring this information together and make it actionable.**

Instead of simply storing academic data, WorkLens focuses on:

> **Observe → Analyze → Identify → Intervene → Improve**

---

## 🎯 Core Objectives

* Centralize academic information in one platform
* Give students a unified academic dashboard
* Help faculty manage academic activities and workflows
* Provide HOD/administrative-level visibility
* Track attendance and student engagement
* Organize courses, assignments, syllabus and study resources
* Improve academic communication
* Enable data-driven intervention for students who may require attention
* Provide AI-assisted academic functionality

---

## ✨ Key Features

### 👨‍🎓 Student Dashboard

Students get a centralized view of their academic activities.

Features include:

* Attendance overview
* Active courses
* Upcoming tasks
* Recent activity
* Academic statistics
* Weekly activity visualization
* Notifications
* Profile management

---

### 📊 Attendance Management

Track and manage attendance across courses.

* Course-wise attendance
* Attendance records
* Attendance statistics
* Attendance visualization
* Academic attendance monitoring

---

### 📚 Course Management

Manage academic courses and their associated information.

* Course listing
* Course selection
* Course-specific academic information
* Course-related assignments and syllabus

---

### 📝 Assignment Management

Students and faculty can manage academic assignments.

* Assignment tracking
* Upcoming assignments
* Assignment status
* Course-based organization
* Deadline visibility

---

### 📖 Syllabus Tracking

WorkLens provides centralized syllabus information.

* Course-wise syllabus
* Topic tracking
* Academic progress visibility
* Structured syllabus management

---

### 📑 Study Materials

Centralized academic resource management.

* Study material organization
* Course-based resources
* Academic content access
* Faculty-provided learning resources

---

### 🗓️ Timetable

Students can access their academic schedules from one place.

* Class schedules
* Course timing
* Academic timetable
* Organized daily schedule

---

### 💻 Online Classes

Support for online academic sessions.

* Online class management
* Class information
* Scheduled online sessions
* Student access to class details

---

### 👩‍🏫 Lesson Plans

Faculty can manage lesson planning.

* Lesson plan creation
* Academic planning
* Course-wise lesson organization
* Teaching progress management

---

### 🔄 Academic Workflow

WorkLens includes workflow management for academic processes.

The system can manage workflow states and provide structured visibility into pending and completed academic activities.

---

### 📨 Notifications

Centralized notification system for academic updates.

* Academic notifications
* Assignment-related updates
* Workflow notifications
* Important system alerts

---

### 💬 Messaging

WorkLens includes an internal messaging system for communication between users.

* User messaging
* Academic communication
* Message management
* Centralized communication

---

### 🏖️ Leave Management

Students can manage academic leave-related information.

* Leave requests
* Leave records
* Leave status
* Leave management workflow

---

### 📋 Activity Logs

WorkLens records academic activity to provide better visibility into student engagement.

Activity data can be used to understand:

* Student participation
* Academic activity
* Recent actions
* Engagement patterns

---

### ⚙️ Settings & Profile

Users can manage their platform preferences and profile information.

* Profile management
* Application settings
* User preferences

---

## 🧑‍💼 HOD / Academic Administration Dashboard

WorkLens also includes a dedicated HOD/administrative interface.

The HOD dashboard is designed to provide higher-level academic visibility.

It includes components for:

* Academic snapshots
* Action-required items
* Availability monitoring
* Upcoming deadlines
* Administrative workflows
* Academic overview
* Faculty/student-related information

This moves WorkLens beyond a simple student management system toward an **institution-level academic intelligence platform**.

---

## 🤖 AI Integration

WorkLens includes an AI layer using the **Google Generative AI API**.

The AI architecture is designed to support intelligent academic assistance and future data-driven capabilities.

Potential applications include:

* Academic assistance
* Intelligent summaries
* Student insights
* Academic recommendations
* Intervention suggestions
* Natural-language interaction with academic information

---

# 🏗️ System Architecture

WorkLens follows a full-stack architecture:

```text
                    ┌─────────────────────────┐
                    │        WorkLens         │
                    │     Web Application     │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     React Frontend      │
                    │                         │
                    │ • Dashboard             │
                    │ • Attendance            │
                    │ • Courses               │
                    │ • Assignments           │
                    │ • Syllabus              │
                    │ • HOD Dashboard         │
                    │ • Messaging             │
                    └────────────┬────────────┘
                                 │
                              REST API
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     Node.js + Express   │
                    │        Backend          │
                    │                         │
                    │ • Authentication        │
                    │ • Business Logic        │
                    │ • REST APIs             │
                    │ • Controllers           │
                    │ • Middleware             │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │        MongoDB          │
                    │                         │
                    │ • Users                 │
                    │ • Courses               │
                    │ • Attendance            │
                    │ • Assignments           │
                    │ • Activities            │
                    │ • Notifications         │
                    │ • Messages              │
                    └─────────────────────────┘

                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     Google Generative   │
                    │          AI             │
                    └─────────────────────────┘
```

---

# 🛠️ Tech Stack

## Frontend

* **React.js**
* **Vite**
* **React Router**
* **Tailwind CSS**
* **Axios**
* **Zustand**
* **Recharts**
* **Chart.js**
* **Lucide React**
* **React Datepicker**

## Backend

* **Node.js**
* **Express.js**
* **MongoDB**
* **Mongoose**
* **REST APIs**
* **JWT/Authentication architecture**
* **bcryptjs**
* **CORS**
* **dotenv**

## AI

* **Google Generative AI**

---

# 📁 Project Structure

```text
WorkLens/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── HOD/
│   │   │   ├── DashboardHeader.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── StatsCards.jsx
│   │   │   ├── AttendanceTable.jsx
│   │   │   ├── UpcomingTasks.jsx
│   │   │   └── ...
│   │   │
│   │   ├── pages/
│   │   │   ├── HOD/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Attendance.jsx
│   │   │   ├── AssignmentsPage.jsx
│   │   │   ├── CoursesPage.jsx
│   │   │   ├── ActivityLogs.jsx
│   │   │   ├── SyllabusPage.jsx
│   │   │   ├── TimetablePage.jsx
│   │   │   ├── StudyMaterialsPage.jsx
│   │   │   ├── OnlineClassesPage.jsx
│   │   │   ├── LessonPlansPage.jsx
│   │   │   ├── LeaveManagement.jsx
│   │   │   └── ...
│   │   │
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── store/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── config/
│   ├── controller/
│   │   └── HOD/
│   │
│   ├── middleware/
│   ├── models/
│   │   └── HOD/
│   │
│   ├── routes/
│   │   └── HOD/
│   │
│   ├── scripts/
│   ├── utils/
│   ├── server.js
│   └── package.json
│
└── README.md
```

---

# 🔌 API Modules

The backend currently exposes REST API modules for:

```text
/api/auth
/api/settings
/api/dashboard
/api/workflow
/api/leaves
/api/attendance
/api/activity-logs
/api/courses
/api/assignments
/api/duties
/api/notifications
/api/study-materials
/api/syllabus
/api/online-classes
/api/timetable
/api/messages
/api/lesson-plans
/api/ai
/api/hod
```

---

# 🗄️ Data Models

WorkLens uses MongoDB with Mongoose models for major academic entities including:

* User
* Faculty
* Course
* Attendance
* Assignment
* Activity Log
* Leave
* Extra Duty
* Notification
* Message
* Lesson Plan
* Syllabus
* Study Material
* Online Class

This provides a modular foundation for extending the platform as institutional requirements grow.

---

# ⚙️ Getting Started

## 1. Clone the repository

```bash
git clone https://github.com/<your-username>/worklens.git

cd worklens
```

---

## 2. Install frontend dependencies

```bash
cd frontend
npm install
```

---

## 3. Install backend dependencies

Open another terminal:

```bash
cd backend
npm install
```

---

# 🔐 Environment Variables

Create a `.env` file inside the `backend` directory.

Example:

```env
PORT=8000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GOOGLE_API_KEY=your_google_generative_ai_key
```

> **Never commit `.env` files or API keys to GitHub.**

For the frontend, configure the API base URL according to your environment.

Example:

```env
VITE_API_URL=http://localhost:8000
```

---

# ▶️ Run the Application

### Start Backend

```bash
cd backend
npm run dev
```

Backend will run on:

```text
http://localhost:8000
```

### Start Frontend

In another terminal:

```bash
cd frontend
npm run dev
```

Vite will provide the local development URL.

---

# 🌱 Database Seeding

The backend includes seed scripts for initializing development data.

Available commands:

```bash
npm run seed
```

```bash
npm run seed:users
```

```bash
npm run seed:leaves
```

```bash
npm run seed:notifications
```

Or seed everything:

```bash
npm run seed:all
```

---

# 🔒 Security Considerations

WorkLens uses several standard backend practices:

* Password hashing with bcrypt
* Environment-based configuration
* API-based authentication
* CORS configuration
* MongoDB through Mongoose
* Separation of routes, controllers and models

For production deployment, additional controls should be implemented, including:

* Strong JWT/session security
* Rate limiting
* Input validation
* Role-based access control
* Secure HTTP headers
* Audit logging
* Production secrets management

---

# 📈 Future Vision

WorkLens is being developed toward an **Academic Intelligence + Intervention Platform** rather than only a student dashboard.

Future capabilities can include:

### 🧠 Student Risk Detection

Identify students who may be academically at risk using signals such as:

```text
Low Attendance
      +
Missed Assignments
      +
Reduced Activity
      +
Poor Academic Performance
      ↓
Risk Detection
      ↓
Faculty Intervention
      ↓
Student Support
      ↓
Outcome Tracking
```

### 📊 Institutional Analytics

Provide institutions with insights into:

* Attendance trends
* Course performance
* Student engagement
* Faculty workload
* Assignment completion
* Academic risk
* Intervention outcomes

### 🤖 AI-Powered Academic Intelligence

Future AI capabilities can include:

* Student risk summaries
* Personalized study recommendations
* Faculty insights
* Academic performance explanations
* Natural-language analytics
* Automated intervention recommendations

### 🏫 Multi-Institution Platform

The long-term architecture can support:

```text
University
   │
   ├── Departments
   │     ├── Faculty
   │     └── Students
   │
   ├── Courses
   ├── Academic Programs
   └── Analytics
```

This can allow WorkLens to evolve from a project into a scalable **SaaS platform for educational institutions**.

---

# 🎯 Product Vision

> **WorkLens aims to transform academic data into timely, measurable action.**

Instead of asking:

> *"What happened?"*

WorkLens aims to help institutions answer:

> **"Who needs attention, why do they need it, what should we do, and did the intervention work?"**

---

# 👥 Project

**WorkLens — Academic Intelligence & Intervention Platform**

Built as a full-stack academic management and intelligence system using modern web technologies.

---

## 📌 Status

🚧 **Active Development**

The current version contains the core student, academic, workflow, communication, administrative, and AI infrastructure. The platform is being extended toward predictive analytics, intervention management, and institution-level academic intelligence.

---

## 📄 License

This project is currently intended for educational and development purposes.

Add an appropriate open-source license before publicly permitting reuse.
