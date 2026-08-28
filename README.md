# TrioByte Portal

A full-stack internal company portal built with **React + Vite** on the frontend, **Node.js + Express** on the backend, and **PostgreSQL** for persistent data.

The project supports role-based access for CEO, Admin, HR, Employee, and Intern users and includes employee management, projects, tasks, attendance, leave, daily work logs, salary, overtime, announcements, repositories, chat, notifications, login activity, and calendar events.

---

## 1. Project Overview

### Main technologies

| Layer | Technology |
|---|---|
| Frontend | React 18 |
| Frontend tooling | Vite 5 |
| Backend | Node.js + Express 4 |
| Database | PostgreSQL |
| Database driver | `pg` |
| Authentication | JWT |
| Password hashing | `bcryptjs` |
| API communication | REST |
| Icons | `lucide-react` |
| Environment variables | `dotenv` |
| Development server | `nodemon` |

### High-level architecture

```text
┌──────────────────────────┐
│      React Frontend      │
│        Vite / JSX        │
│                          │
│  Dashboard / Modules /   │
│  Forms / Role-based UI   │
└────────────┬─────────────┘
             │
             │ HTTP / REST
             │ Bearer JWT
             ▼
┌──────────────────────────┐
│     Express Backend      │
│                          │
│ /auth/*                  │
│ /api/*                   │
│ /api/calendar/*          │
│                          │
│ JWT Authentication       │
│ Authorization            │
│ Business Logic           │
└────────────┬─────────────┘
             │
             │ SQL via pg
             ▼
┌──────────────────────────┐
│       PostgreSQL         │
│                          │
│ Users                    │
│ Projects / Tasks         │
│ Attendance / Leave       │
│ Salary / Overtime        │
│ Chat / Notifications     │
│ Logs / Repositories      │
└──────────────────────────┘
```

---

# 2. Repository Structure

```text
TrioByte_Final_Demo/
│
├── frontend/
│   ├── src/
│   │   ├── api.js
│   │   ├── main.jsx
│   │   ├── styles.css
│   │   └── Triobyte.jpeg
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── backend/
│   ├── db/
│   │   ├── init.js
│   │   ├── pool.js
│   │   └── seed.js
│   │
│   ├── middleware/
│   │   └── auth.js
│   │
│   ├── routes/
│   │   ├── api.js
│   │   ├── auth.js
│   │   └── calendar.js
│   │
│   ├── app.js
│   ├── package.json
│   ├── package-lock.json
│   └── .env.example
│
└── README.md
```

> `node_modules/` should not normally be committed or shared. Dependencies should be recreated with `npm install`.

---

# 3. Features

## Authentication

- Login using email and password
- JWT-based authentication
- Password hashing using bcrypt
- Forgot-password endpoint
- Logout and login activity tracking
- Blocked-user support
- Forced password-change flag
- Role-based access

## Supported roles

The application supports:

- **CEO**
- **ADMIN**
- **HR**
- **EMPLOYEE**
- **INTERN**

Roles are stored in lowercase in the seeded demo data, while the database constraint accepts the role values case-insensitively.

---

## Employee Management

Management users can manage employee records including:

- Employee ID
- Full name
- Email
- Department
- Designation
- Employment type
- Employee level
- Company ID
- Mobile number
- Address
- Joining date
- End date
- Mentor
- Profile photo URL
- Account blocked status
- Password-change requirement

---

## Dashboard

The dashboard provides role-aware information such as:

- User information
- Projects
- Tasks
- Attendance
- Leave
- Daily work
- Salary
- Overtime
- Announcements
- Notifications
- Activity
- Repositories
- Chat
- Calendar events

The exact information visible to a user depends on their role and permissions.

---

## Project Management

Projects support:

- Project name
- Description
- Project lead
- Project members
- Creator
- Start date
- Deadline
- Status
- Priority
- Progress

Project statuses include values such as:

- Planning
- Active
- Review
- Completed
- On Hold
- Cancelled

---

## Task Management

Tasks support:

- Task title
- Description
- Project
- Multiple assignees
- Creator
- Start date
- Deadline
- Status
- Priority
- Individual progress
- Overall progress

Progress is tracked from 0–100%.

---

## Attendance

Users can have attendance records containing:

- Work date
- Check-in
- Check-out
- Attendance status

A user can have only one attendance record per work date.

---

## Leave Management

Leave requests contain:

- Employee
- Leave type
- Start date
- End date
- Reason
- Status
- Reviewer
- Creation timestamp

---

## Daily Work Logs

Employees can record:

- Work date
- Work summary/content
- Progress percentage

---

## Salary

Salary records contain:

- Employee
- Month
- Amount
- Processing status

---

## Overtime

Overtime records contain:

- Employee
- Work date
- Number of hours
- Reason
- Status

---

## Announcements

Management can create announcements containing:

- Title
- Content
- Creator
- Creation timestamp

---

## Repositories

Repository records can be associated with projects and users and contain:

- Repository name
- Project
- Owner
- Branch
- Last updated timestamp

---

## Chat

The portal includes direct user-to-user messaging.

Chat messages contain:

- Sender
- Receiver
- Message body
- Message type
- Creation timestamp

---

## Notifications

Notifications support:

- User
- Title
- Body
- Read/unread state
- Creation timestamp

Users can mark individual notifications or all notifications as read.

---

## Calendar

Calendar events are exposed through:

```text
GET /api/calendar/events
```

---

# 4. Database

The application uses PostgreSQL.

The database schema is created by:

```bash
npm run init-db
```

from the `backend` directory.

The current database contains the following main tables:

```text
users
projects
tasks
task_assignments
project_members
attendance
leave_requests
daily_work_logs
announcements
salary_records
overtime
login_logs
repositories
chat_messages
notifications
```

### Important relationships

```text
users
 │
 ├── projects
 │      ├── project_members
 │      └── tasks
 │              └── task_assignments
 │
 ├── attendance
 ├── leave_requests
 ├── daily_work_logs
 ├── salary_records
 ├── overtime
 ├── login_logs
 ├── repositories
 ├── chat_messages
 └── notifications
```

Foreign keys are used throughout the schema to maintain relationships between users, projects, tasks, and other modules.

---

# 5. Prerequisites

Install the following before running the project:

- Node.js
- npm
- PostgreSQL

Recommended:

```text
Node.js 18+ 
PostgreSQL 14+
npm 9+
```

Check your installation:

```bash
node --version
npm --version
psql --version
```

---

# 6. PostgreSQL Setup

Create a PostgreSQL database.

Example:

```sql
CREATE DATABASE triobyte_portal1;
```

Make sure the PostgreSQL username and password are available.

The backend expects a PostgreSQL connection string in the following format:

```text
postgres://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

Example:

```text
postgres://postgres:your_password@localhost:5432/triobyte_portal1
```

---

# 7. Backend Environment Configuration

Go to:

```bash
cd backend
```

Copy the example environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env`:

```env
PORT=8000
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/triobyte_portal1
JWT_SECRET=replace_this_with_a_long_random_secret
```

### Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Backend HTTP port |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign JWT authentication tokens |

**Never share production secrets in Git, ZIP files, screenshots, or public repositories.**

---

# 8. Install Backend Dependencies

From the backend directory:

```bash
cd backend
npm install
```

This installs:

- Express
- PostgreSQL driver
- JWT
- bcryptjs
- CORS
- dotenv
- nodemon

---

# 9. Initialize the Database

After PostgreSQL is running and `.env` is configured:

```bash
cd backend
npm run init-db
```

This creates the required tables and applies compatibility/migration changes for older database schemas.

A successful initialization should report:

```text
Database schema created successfully
```

---

# 10. Seed Demo Data

After initializing the schema:

```bash
npm run seed
```

The seed script clears the existing demo records and creates a fresh demonstration dataset.

### Important

`npm run seed` is destructive to the existing data in the demo database.

Do **not** run it against a production database containing real information.

---

# 11. Demo Accounts

The seed script creates these demo accounts:

| Role | Email |
|---|---|
| CEO | `ceo@triobyte.demo` |
| Admin | `admin@triobyte.demo` |
| HR | `hr@triobyte.demo` |
| Employee | `employee@triobyte.demo` |
| Employee | `neha@triobyte.demo` |
| Intern | `intern@triobyte.demo` |

### Demo password

```text
Demo@123
```

These credentials are intended for demonstration/testing only.

For a real deployment, replace them with secure accounts and passwords.

---

# 12. Start the Backend

From:

```bash
backend/
```

Run:

```bash
npm run dev
```

or:

```bash
npm start
```

The backend runs by default on:

```text
http://localhost:8000
```

The root endpoint can be checked at:

```text
GET /
```

Expected response:

```json
{
  "name": "TrioByte Portal API",
  "status": "running"
}
```

---

# 13. Frontend Setup

Open another terminal.

Go to:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

The frontend uses Vite.

Start the development server:

```bash
npm run dev
```

Vite will display the local frontend URL in the terminal, normally similar to:

```text
http://localhost:5173
```

---

# 14. Frontend API Configuration

The frontend API helper uses:

```text
VITE_API_URL
```

If it is not supplied, it defaults to:

```text
http://localhost:8000
```

For local development, the default is therefore normally sufficient.

For a separately deployed backend, create a frontend environment file such as:

```env
VITE_API_URL=https://your-backend-domain.example
```

Then rebuild the frontend.

---

# 15. Running the Complete Project

You need two processes running.

### Terminal 1 — Backend

```bash
cd backend
npm install
npm run init-db
npm run seed
npm run dev
```

### Terminal 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Then open the Vite URL shown in the frontend terminal.

---

# 16. Authentication Flow

The basic authentication flow is:

```text
User
  │
  │ email + password
  ▼
POST /auth/login
  │
  ▼
Backend verifies user
  │
  ├── bcrypt password verification
  ├── blocked-account check
  └── JWT generation
  │
  ▼
JWT returned to frontend
  │
  ▼
Frontend stores token in localStorage
  │
  ▼
API requests send:
Authorization: Bearer <token>
```

The frontend stores the token under:

```text
tb_token
```

---

# 17. API Reference

## Authentication

### Login

```http
POST /auth/login
```

### Forgot password

```http
POST /auth/forgot-password
```

---

## User / Session APIs

```http
GET    /api/me
PUT    /api/profile
POST   /api/logout
GET    /api/activity
PUT    /api/settings/password
```

---

## Search and Notifications

```http
GET /api/search
GET /api/notifications
PUT /api/notifications/:id/read
PUT /api/notifications/read-all
```

---

## Dashboard

```http
GET /api/dashboard
```

---

## User Administration

```http
GET  /api/users
POST /api/users
PUT  /api/users/:id/block
```

---

## Projects

```http
GET  /api/projects
GET  /api/projects/:id
POST /api/projects
PUT  /api/projects/:id
POST /api/projects/:id/next-phase
```

---

## Tasks

```http
POST   /api/tasks
PUT    /api/tasks/:id
PUT    /api/tasks/:id/progress
DELETE /api/tasks/:id
```

---

## Attendance

```http
GET /api/attendance
```

---

## Leave

```http
GET  /api/leave
POST /api/leave
PUT  /api/leave/:id
```

---

## Daily Work

```http
GET  /api/daily-work
POST /api/daily-work
```

---

## Salary

```http
GET /api/salary
```

---

## Overtime

```http
GET /api/overtime
```

---

## Announcements

```http
GET  /api/announcements
POST /api/announcements
```

---

## Repositories

```http
GET /api/repos
```

---

## Chat

```http
GET  /api/chat
POST /api/chat
```

---

## Login Logs

```http
GET /api/logs
```

---

## Calendar

```http
GET /api/calendar/events
```

---

# 18. Role-Based Access

The portal is designed around different responsibilities.

### CEO

High-level organizational visibility and management functionality.

### Admin

System and operational management, including users, projects and tasks.

### HR

Employee and HR-related workflows such as leave, announcements and employee information.

### Employee

Personal and work-related functions such as:

- Profile
- Tasks
- Projects
- Attendance
- Leave
- Daily work
- Salary
- Overtime
- Notifications
- Chat

### Intern

Restricted employee-style functionality according to the application's authorization rules.

> The backend should be treated as the final authority for authorization. Hiding a frontend button does not, by itself, provide security.

---

# 19. Database Initialization vs. Seeding

These two commands have different purposes.

### `npm run init-db`

Creates and updates the database schema.

Use when:

- Setting up the project for the first time
- Updating an older schema
- Recreating a development database

### `npm run seed`

Creates demo data.

Use when:

- Preparing a fresh demonstration
- Resetting the demo database
- Reproducing the standard test scenario

Do not confuse schema initialization with demo data seeding.

---

# 20. Production / Deployment Notes

For deployment, separate the application into:

```text
Frontend hosting
       │
       ▼
React/Vite application

       │ HTTPS API
       ▼

Backend hosting
       │
       ▼
PostgreSQL database
```

The production setup should use:

- HTTPS
- A managed PostgreSQL database
- Strong random `JWT_SECRET`
- Secure database credentials
- Environment variables
- Restricted database access
- Production CORS configuration
- Secure authentication practices
- Separate production and demo databases
- Backups
- Logging and monitoring

Do not use the seeded demo password in production.

---

# 21. Security Notes

Before handing this project to another person, check the following.

### Do not share

```text
.env
real API keys
real database passwords
production JWT secrets
private certificates
private tokens
real employee information
```

The repository should contain:

```text
.env.example
```

but not a real production `.env`.

### Recommended `.gitignore`

```gitignore
node_modules/
.env
.env.*
!.env.example
dist/
build/
*.log
.DS_Store
```

---

# 22. Important Handoff Note

A ZIP containing source code is **not necessarily the complete application environment**.

For a reviewer who needs to inspect everything, provide:

1. The source-code repository/ZIP
2. A working deployed frontend URL
3. Backend/API access or deployment information
4. A PostgreSQL database or database dump when appropriate
5. Test accounts
6. Environment-variable instructions
7. This README
8. Any required third-party integration credentials through a secure channel

Do not put secrets directly inside this README.

---

# 23. Recommended Reviewer Test Plan

A reviewer can test the application in the following order.

## Step 1 — Login

Test:

```text
CEO
Admin
HR
Employee
Intern
```

Confirm that each role receives the expected access.

## Step 2 — Profile

- View profile
- Update profile
- Check role and employee information

## Step 3 — Dashboard

- Check dashboard statistics
- Check visible modules
- Confirm role-specific visibility

## Step 4 — Projects

As an authorized management user:

- Create a project
- Select a project lead
- Add members
- Set dates
- Set priority
- Change status
- Review project details

## Step 5 — Tasks

- Create a task
- Assign employees
- Set priority
- Set dates
- Update progress
- Verify overall progress

## Step 6 — Attendance

- Review attendance records
- Check employee-specific visibility

## Step 7 — Leave

- Submit a leave request
- Review it using an authorized management/HR account
- Verify status changes

## Step 8 — Daily Work

- Submit a daily work entry
- Set progress
- Review the resulting record

## Step 9 — Salary / Overtime

- Review salary records
- Review overtime records

## Step 10 — Announcements

- Create an announcement with an authorized account
- Confirm it appears to users

## Step 11 — Notifications

- Open notifications
- Mark individual notifications as read
- Mark all notifications as read

## Step 12 — Chat

- Send a message between users
- Verify sender/receiver behavior

## Step 13 — Calendar

- Open calendar events
- Confirm events are returned from the backend

## Step 14 — Authorization

Try accessing management features using a lower-privilege account.

The reviewer should confirm that unauthorized operations are rejected by the backend, not merely hidden in the UI.

---

# 24. Troubleshooting

## Backend cannot connect to PostgreSQL

Check:

```text
DATABASE_URL
PostgreSQL service
database name
username
password
port
```

Then run:

```bash
npm run init-db
```

---

## Frontend says it cannot connect to backend

Check that the backend is running:

```bash
npm run dev
```

Confirm:

```text
http://localhost:8000
```

returns the API status response.

Also check the frontend `VITE_API_URL` value.

---

## Login does not work

Verify that demo data has been seeded:

```bash
npm run seed
```

Then try:

```text
Email: admin@triobyte.demo
Password: Demo@123
```

---

## Database schema errors

If this is a fresh development database:

```bash
npm run init-db
npm run seed
```

If the database contains important data, do **not** blindly run destructive seed operations. Back up the database first.

---

## Port already in use

If port `8000` is already occupied, change:

```env
PORT=8000
```

to another available port.

If the frontend uses the backend URL explicitly, update `VITE_API_URL` accordingly.

---

# 25. Development Commands

## Backend

```bash
npm install
npm run init-db
npm run seed
npm run dev
npm start
```

## Frontend

```bash
npm install
npm run dev
npm run build
npm run preview
```

---

# 26. Build for Production

Frontend:

```bash
cd frontend
npm run build
```

The production frontend build is generated by Vite.

Preview the production build locally:

```bash
npm run preview
```

Backend:

```bash
cd backend
npm start
```

---

# 27. Current Demo Dataset

The seed script creates:

- 1 CEO
- 1 Admin
- 1 HR user
- 2 Employees
- 1 Intern
- 1 demo project
- Multiple demo tasks
- Demo announcements
- Demo salary records
- Demo attendance records
- A demo leave request

This dataset is intended to make the major portal workflows immediately testable after setup.

---

# 28. Backend Scheduled Behavior

The backend periodically checks for open login sessions.

At 23:00 server time, open login sessions are automatically closed in the `login_logs` table.

This is implemented in:

```text
backend/app.js
```

The behavior depends on the server's configured/system time.

---

# 29. Code Organization

### Frontend

Main frontend behavior is contained in:

```text
frontend/src/main.jsx
```

API communication is centralized through:

```text
frontend/src/api.js
```

Styling is primarily contained in:

```text
frontend/src/styles.css
```

### Backend

Application bootstrap:

```text
backend/app.js
```

Database connection:

```text
backend/db/pool.js
```

Database schema:

```text
backend/db/init.js
```

Demo data:

```text
backend/db/seed.js
```

Authentication middleware:

```text
backend/middleware/auth.js
```

Authentication routes:

```text
backend/routes/auth.js
```

Application API routes:

```text
backend/routes/api.js
```

Calendar routes:

```text
backend/routes/calendar.js
```

---

# 30. Reviewer Checklist

```text
[ ] Project installs successfully
[ ] PostgreSQL connection works
[ ] Database schema initializes
[ ] Demo data seeds successfully
[ ] Backend starts
[ ] Frontend starts
[ ] Login works
[ ] JWT authentication works
[ ] Role-based access works
[ ] Dashboard works
[ ] Employee management works
[ ] Project management works
[ ] Task management works
[ ] Attendance works
[ ] Leave workflow works
[ ] Daily work works
[ ] Salary records display
[ ] Overtime records display
[ ] Announcements work
[ ] Notifications work
[ ] Repository records display
[ ] Chat works
[ ] Calendar works
[ ] Unauthorized backend operations are rejected
[ ] No secrets are exposed in the shared source
```

---

# 31. Project Handoff

For a complete review, the recommended handoff package is:

```text
TrioByte/
│
├── frontend/
├── backend/
├── README.md
└── .gitignore
```

Along with:

```text
1. Live application URL
2. Test credentials
3. PostgreSQL setup instructions
4. Secure environment-variable values
5. Database dump, if the reviewer needs the exact current database contents
6. Any deployment/infrastructure information
```

### Do not send production secrets inside the ZIP.

If the reviewer needs access to the actual database, provide access through the appropriate database hosting/provider permissions or a sanitized database dump rather than exposing the production database password.

---

# 32. Quick Start

For a fresh local setup:

```bash
# 1. Create PostgreSQL database
CREATE DATABASE triobyte_portal1;

# 2. Backend
cd backend
npm install

# 3. Configure backend/.env
# PORT=8000
# DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/triobyte_portal1
# JWT_SECRET=your_long_random_secret

# 4. Create database schema
npm run init-db

# 5. Add demo data
npm run seed

# 6. Start backend
npm run dev
```

In another terminal:

```bash
# 7. Frontend
cd frontend
npm install

# 8. Start frontend
npm run dev
```

Then open the frontend URL shown by Vite and log in with:

```text
admin@triobyte.demo
```

Password:

```text
Demo@123
```

---

# 33. Final Notes

This project is structured as a conventional full-stack web application:

```text
React/Vite
    ↓
REST API
    ↓
Express
    ↓
JWT + Authorization
    ↓
PostgreSQL
```

The database is an actual PostgreSQL database rather than frontend-only/local mock data. The backend owns the persistent business data and exposes REST endpoints consumed by the React frontend.

For evaluation, the strongest setup is to give the reviewer both:

- a **live deployed application** for functional testing, and
- **source/database access** for technical inspection.

The ZIP/source code by itself does not automatically contain a live PostgreSQL database instance or its running state.
