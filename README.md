# Smart Attendance System

A complete digital attendance management system for educational institutions with web dashboard, mobile app, and REST API.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js + Express.js + Firebase Admin SDK |
| Web Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Mobile App | React Native + Expo |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| Storage | Firebase Storage |

**Colors:** Primary `#B40808`, Secondary `#FFFFFF`

## Project Structure

```
smart-attendance-system/
├── backend/          # Express.js API server
├── web-frontend/     # Next.js 14 web app
├── mobile-app/       # React Native + Expo
├── docs/             # API docs, deployment guide
├── docker-compose.yml
└── README.md
```

## Features

### Teacher Module
- Timetable dashboard with auto-detect current class
- One-click "Start Attendance" button
- Student list with photos, roll numbers
- Mark Present/Absent/Late (real-time Firestore)
- Review skipped students before submit
- Attendance history with pagination
- Offline mode with auto-sync

### Student Module
- Subject-wise attendance percentage dashboard
- Calendar view of attendance history
- Threshold alerts (<75% red warning)
- Push notifications (Expo)

### Admin Panel
- **Subject Management** — Create, edit, delete subjects (code, name, department, semester, credits)
- **Class Management** — Create classes (department, semester, section, academic year) and assign/remove students
- **Timetable & Scheduling** — Assign teachers to classes with subject, day, time slot, and room; automatic conflict detection for both teacher and class schedules
- User management (CRUD teachers/students/admins)
- Campus-wide attendance reports
- Export Excel/PDF
- Configure threshold policy
- System logs viewer

## Quick Start

### Prerequisites

- Node.js 20+
- Firebase project (see [Firebase Setup](docs/firebase-setup.md))
- Expo CLI (`npm i -g expo-cli`)

### 1. Clone & Configure

```bash
git clone <repo-url>
cd smart-attendance-system

# Configure environment variables
cp backend/.env.example backend/.env
cp web-frontend/.env.example web-frontend/.env
cp mobile-app/.env.example mobile-app/.env
# Edit each .env file with your Firebase credentials
```

### 2. Backend

```bash
cd backend
npm install
npm run seed    # Seed sample data
npm run dev     # Starts on http://localhost:5000
```

API docs at: http://localhost:5000/api-docs

### 3. Web Frontend

```bash
cd web-frontend
npm install
npm run dev     # Starts on http://localhost:3000
```

### 4. Mobile App

```bash
cd mobile-app
npm install
npx expo start  # Scan QR with Expo Go
```

### 5. Docker (Backend + Web)

```bash
docker-compose up --build
```

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@smartattendance.com | Admin@123 |
| Teacher | teacher1@smartattendance.com | Teacher@123 |
| Student | student1@smartattendance.com | Student@123 |

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | - | Login with Firebase ID token |
| POST | `/api/auth/refresh` | - | Refresh JWT |
| GET | `/api/auth/profile` | All | Get profile |
| GET | `/api/teacher/timetable` | Teacher | Get timetable |
| GET | `/api/teacher/current-class` | Teacher | Auto-detect class |
| POST | `/api/teacher/attendance/start` | Teacher | Start session |
| POST | `/api/teacher/:classId/attendance` | Teacher | Mark attendance |
| POST | `/api/teacher/:classId/attendance/submit` | Teacher | Submit |
| GET | `/api/teacher/:classId/attendance` | Teacher | History |
| GET | `/api/student/dashboard` | Student | Dashboard |
| GET | `/api/student/:id/attendance` | Student | History |
| GET | `/api/student/:id/calendar` | Student | Calendar view |
| GET | `/api/admin/users` | Admin | List users |
| POST | `/api/admin/users` | Admin | Create user |
| PUT | `/api/admin/users/:id` | Admin | Update user |
| DELETE | `/api/admin/users/:id` | Admin | Delete user |
| GET | `/api/admin/subjects` | Admin | List subjects |
| POST | `/api/admin/subjects` | Admin | Create subject |
| PUT | `/api/admin/subjects/:id` | Admin | Update subject |
| DELETE | `/api/admin/subjects/:id` | Admin | Delete subject |
| GET | `/api/admin/classes` | Admin | List classes |
| POST | `/api/admin/classes` | Admin | Create class |
| GET | `/api/admin/classes/:id` | Admin | Class details (students + timetable) |
| PUT | `/api/admin/classes/:id` | Admin | Update class |
| DELETE | `/api/admin/classes/:id` | Admin | Delete class |
| POST | `/api/admin/classes/:id/students` | Admin | Assign students to class |
| DELETE | `/api/admin/classes/:id/students` | Admin | Remove students from class |
| GET | `/api/admin/timetables` | Admin | List timetable entries |
| POST | `/api/admin/timetables` | Admin | Create timetable entry |
| PUT | `/api/admin/timetables/:id` | Admin | Update timetable entry |
| DELETE | `/api/admin/timetables/:id` | Admin | Delete timetable entry |
| GET | `/api/admin/reports` | Admin | Reports |
| GET | `/api/admin/reports/export/excel` | Admin | Excel export |
| GET | `/api/admin/reports/export/pdf` | Admin | PDF export |
| GET/PUT | `/api/admin/config` | Admin | System config |
| GET | `/api/admin/logs` | Admin | System logs |
| POST | `/api/sync/queue` | All | Offline sync |

## Deployment

See [Deployment Guide](docs/deployment-guide.md) for:
- Vercel (Web Frontend)
- Docker/Railway (Backend)
- Expo EAS (Mobile)

## Security

- JWT + Firebase Auth with RBAC
- Zod input validation
- Rate limiting (100 req/15min)
- Helmet security headers
- CORS configured
- Firestore security rules
- HTTPS enforced in production

## License

MIT
