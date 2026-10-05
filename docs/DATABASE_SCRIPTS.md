# Proctora Database Management Scripts

This document details all available database maintenance, seeding, and flush scripts in Proctora, including what each script does, the database tables affected, and the exact commands to execute them.

---

## Quick Reference Table

| Purpose | NPM Script | Run from Root | Run from `backend/` |
| :--- | :--- | :--- | :--- |
| **Reset Entire DB (Keep Admin)** | `db:reset-except-admin` | `npm --prefix backend run db:reset-except-admin` | `npm run db:reset-except-admin` |
| **Flush All Exams & Tests** | `db:flush-exams` | `npm --prefix backend run db:flush-exams` | `npm run db:flush-exams` |
| **Flush All Candidate Users** | `db:flush-users` | `npm --prefix backend run db:flush-users` | `npm run db:flush-users` |
| **Seed Initial Demo Data** | `db:seed` | `npm --prefix backend run db:seed` | `npm run db:seed` |
| **Push Schema to Postgres** | `db:push` | `npm --prefix backend run db:push` | `npm run db:push` |
| **Run Prisma Migrations** | `db:migrate` | `npm --prefix backend run db:migrate` | `npm run db:migrate` |
| **Generate Prisma Client** | `db:generate` | `npm --prefix backend run db:generate` | `npm run db:generate` |
| **Open Prisma Studio GUI** | `db:studio` | `npm --prefix backend run db:studio` | `npm run db:studio` |

---

## Detailed Script Descriptions

### 1. Reset Entire Database Except Admin (`db:reset-except-admin`)

- **Script Path**: `backend/src/scripts/resetDatabaseExceptAdmin.ts`
- **Goal**: Returns the database to a pristine institutional state with **zero** leftover exams, seating plans, logs, telemetry, or student accounts, while preserving all Administrator login accounts.
- **Tables Cleared**:
  - `EditorTelemetryEvent` (Monaco editor telemetry keystrokes/pastes)
  - `FocusLog` (Window focus and tab blur logs)
  - `ProctoringEvent` (Webcam/gaze invigilation anomaly flags)
  - `Accommodation` (Extra-time grants)
  - `ExamResponse` (Candidate exam answers & submissions)
  - `SeatingAssignment` (Classroom desk mappings)
  - `Question` (MCQ, Multi-Correct, Coding, Descriptive questions)
  - `Exam` (All tests and examinations)
  - `Session` (Active login tokens & refresh cookies)
  - `User` (Where `role != 'ADMIN'`)
- **Admin Maintenance**:
  - Automatically clears any lockout status (`isLocked: false`) and resets failed login counters (`failedLoginAttempts: 0`) for `admin@proctora.edu`.
- **Command to Execute**:
  ```bash
  # From project root:
  npm --prefix backend run db:reset-except-admin

  # Or from backend directory:
  cd backend && npm run db:reset-except-admin
  ```

---

### 2. Flush All Exams & Tests (`db:flush-exams`)

- **Script Path**: `backend/src/scripts/flushExams.ts`
- **Goal**: Removes all tests and examinations from the database without deleting any user accounts. Use this when you want to wipe test configurations, question sets, and seating charts, but keep existing student and instructor profiles.
- **Tables Cleared**:
  - `EditorTelemetryEvent`
  - `FocusLog`
  - `ProctoringEvent`
  - `Accommodation`
  - `ExamResponse`
  - `SeatingAssignment`
  - `Question`
  - `Exam`
- **Users Preserved**:
  - All `User` accounts (`ADMIN` and `CANDIDATE`) remain intact.
- **Command to Execute**:
  ```bash
  # From project root:
  npm --prefix backend run db:flush-exams

  # Or from backend directory:
  cd backend && npm run db:flush-exams
  ```

---

### 3. Flush All Candidate Users (`db:flush-users`)

- **Script Path**: `backend/src/scripts/flushNonAdminUsers.ts`
- **Goal**: Deletes all non-admin users (such as test candidates and students) and their associated test submissions and telemetry logs, while leaving examinations and administrator accounts untouched.
- **Tables Affected**:
  - Deletes candidate-linked records in `EditorTelemetryEvent`, `FocusLog`, `ProctoringEvent`, `Accommodation`, `ExamResponse`, `Session`.
  - Deletes candidate `User` records (`role != 'ADMIN'`).
- **Command to Execute**:
  ```bash
  # From project root:
  npm --prefix backend run db:flush-users

  # Or from backend directory:
  cd backend && npm run db:flush-users
  ```

---

### 4. Seed Initial Demo Data (`db:seed`)

- **Script Path**: `backend/prisma/seed.ts`
- **Goal**: Populates standard test credentials and a demo examination with sample questions for testing.
- **What is Created**:
  - **Admin User**: `admin@proctora.edu` / `Admin@12345` (Role: `ADMIN`)
  - **Candidate User**: `student@proctora.edu` / `Student@12345` (Roll: `21CS001`, Role: `CANDIDATE`)
  - **Demo Exam**: `demo-exam-1` (Test ID: `DEMO-CS101`, 90 minutes) with 4 sample questions (MCQ, Coding with Monaco, Multi-Correct, Descriptive) and classroom seating assignment.
- **Command to Execute**:
  ```bash
  # From project root:
  npm --prefix backend run db:seed

  # Or from backend directory:
  cd backend && npm run db:seed
  ```

---

### 5. Inspect Data with Prisma Studio (`db:studio`)

- **Goal**: Launches a local web browser GUI to inspect, search, and edit database records visually.
- **URL**: `http://localhost:5555`
- **Command to Execute**:
  ```bash
  npm --prefix backend run db:studio
  ```

---

## Recommended Workflow Examples

### Starting Completely Fresh for Real Exam Sessions
```bash
# 1. Reset everything except the instructor admin credentials:
npm --prefix backend run db:reset-except-admin

# 2. Log in at http://localhost:5173/login as admin@proctora.edu / Admin@12345
# 3. Use the Instructor Test Studio at /admin/exams to design questions, set timer, and upload seating CSV.
```

### Resetting and Reloading the Demo Suite for Testing
```bash
# 1. Reset everything except admin:
npm --prefix backend run db:reset-except-admin

# 2. Reseed the demo candidate and sample exam:
npm --prefix backend run db:seed
```
