# Proctora Database Management Scripts

This document details all available database maintenance, seeding, and flush scripts in Proctora, including what each script does, the database tables affected, and the exact commands to execute them.

---

## Quick Reference Table

| Purpose | NPM Script | Run from Root | Run from `backend/` |
| :--- | :--- | :--- | :--- |
| **Reset Entire DB (Keep Admins)** | `db:reset-except-admin` | `npm --prefix backend run db:reset-except-admin` | `npm run db:reset-except-admin` |
| **Provision Super Admin** | `db:create-super-admin` | `npm --prefix backend run db:create-super-admin` | `npm run db:create-super-admin` |
| **Flush All Audit Logs** | `db:flush-logs` | `npm --prefix backend run db:flush-logs` | `npm run db:flush-logs` |
| **Flush All Exams & Tests** | `db:flush-exams` | `npm --prefix backend run db:flush-exams` | `npm run db:flush-exams` |
| **Flush All Candidate Users** | `db:flush-users` | `npm --prefix backend run db:flush-users` | `npm run db:flush-users` |
| **Seed Initial Demo Data** | `db:seed` | `npm --prefix backend run db:seed` | `npm run db:seed` |
| **Push Schema to Postgres** | `db:push` | `npm --prefix backend run db:push` | `npm run db:push` |
| **Run Prisma Migrations** | `db:migrate` | `npm --prefix backend run db:migrate` | `npm run db:migrate` |
| **Generate Prisma Client** | `db:generate` | `npm --prefix backend run db:generate` | `npm run db:generate` |
| **Open Prisma Studio GUI** | `db:studio` | `npm --prefix backend run db:studio` | `npm run db:studio` |

---

## Detailed Script Descriptions

### 1. Provision Super Administrator (`db:create-super-admin`)

- **Script Path**: `src/scripts/createSuperAdmin.ts`
- **Goal**: Provisions or resets a Super Administrator account with role `SUPER_ADMIN`. Super Admins possess access to the abstracted `/super-admin` audit logs dashboard with real-time inspection of all system events.
- **Default Credentials**:
  - Email: `superadmin@proctora.edu`
  - Password: `SuperAdmin@12345`
  - Name: `Root Super Administrator`
- **Custom Arguments / Environment Variables**:
  ```bash
  # Via arguments:
  npm --prefix backend run db:create-super-admin -- "superadmin@proctora.edu" "MySecurePassword@123" "Director Of Academics"

  # Or via environment variables:
  SUPERADMIN_EMAIL=admin-root@univ.edu SUPERADMIN_PASSWORD=SecuredPass@2026 npm --prefix backend run db:create-super-admin
  ```
- **Auditing**: Automatically records an `admin_create` event into the `logs` table upon successful provisioning.

---

### 2. Flush Audit Logs (`db:flush-logs`)

- **Script Path**: `src/scripts/flushLogs.ts`
- **Goal**: Cleanses or archives records from the dedicated `logs` table. Allows full wipes or age-based pruning.
- **Usage Modes**:
  ```bash
  # Mode A: Wipe ALL audit logs
  npm --prefix backend run db:flush-logs

  # Mode B: Prune logs older than N days (e.g. keep last 30 days)
  npm --prefix backend run db:flush-logs 30
  ```

---

### 3. Reset Entire Database Except Admins (`db:reset-except-admin`)

- **Script Path**: `src/scripts/resetDatabaseExceptAdmin.ts`
- **Goal**: Returns the database to a pristine institutional state with **zero** leftover exams, seating plans, logs, telemetry, or student accounts, while preserving both `ADMIN` and `SUPER_ADMIN` accounts.
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
  - `User` (Where `role NOT IN ('ADMIN', 'SUPER_ADMIN')`)
- **Admin Maintenance**:
  - Automatically clears lockout status (`isLocked: false`) and resets failed login counters (`failedLoginAttempts: 0`) for all administrators.
- **Command to Execute**:
  ```bash
  npm --prefix backend run db:reset-except-admin
  ```

---

### 4. Flush All Exams & Tests (`db:flush-exams`)

- **Script Path**: `src/scripts/flushExams.ts`
- **Goal**: Removes all tests and examinations from the database without deleting any user accounts. Use this when you want to wipe test configurations, question sets, and seating charts, but keep existing student, instructor, and super admin profiles.
- **Tables Cleared**:
  - `EditorTelemetryEvent`, `FocusLog`, `ProctoringEvent`, `Accommodation`, `ExamResponse`, `SeatingAssignment`, `Question`, `Exam`
- **Users Preserved**:
  - All `User` accounts (`SUPER_ADMIN`, `ADMIN`, `CANDIDATE`) remain intact.
- **Command to Execute**:
  ```bash
  npm --prefix backend run db:flush-exams
  ```

---

### 5. Flush All Candidate Users (`db:flush-users`)

- **Script Path**: `src/scripts/flushNonAdminUsers.ts`
- **Goal**: Deletes all student candidates (`role = CANDIDATE`) and their associated submissions and telemetry, while leaving examinations, instructor accounts (`ADMIN`), and super administrators (`SUPER_ADMIN`) untouched.
- **Command to Execute**:
  ```bash
  npm --prefix backend run db:flush-users
  ```

---

### 6. Seed Initial Demo Data (`db:seed`)

- **Script Path**: `prisma/seed.ts`
- **Goal**: Populates standard test credentials, a demo examination with sample questions, and default administrative profiles.
- **What is Created**:
  - **Super Admin**: `superadmin@proctora.edu` / `SuperAdmin@12345` (Role: `SUPER_ADMIN`)
  - **Admin User**: `admin@proctora.edu` / `Admin@12345` (Role: `ADMIN`)
  - **Candidate User**: `student@proctora.edu` / `Student@12345` (Roll: `21CS001`, Role: `CANDIDATE`)
  - **Demo Exam**: `demo-exam-1` (Test ID: `DEMO-CS101`, 90 minutes) with 4 sample questions (MCQ, Coding with Monaco, Multi-Correct, Descriptive) and classroom seating plan.
- **Command to Execute**:
  ```bash
  npm --prefix backend run db:seed
  ```

---

### 7. Inspect Data with Prisma Studio (`db:studio`)

- **Goal**: Launches a local web browser GUI to inspect, search, and edit database records visually (including the `logs` table).
- **URL**: `http://localhost:5555`
- **Command to Execute**:
  ```bash
  npm --prefix backend run db:studio
  ```

---

## Recommended Workflow Examples

### Starting Fresh with Super Admin & Exam Admin
```bash
# 1. Reset everything except administrator accounts:
npm --prefix backend run db:reset-except-admin

# 2. Provision or refresh Super Admin credentials:
npm --prefix backend run db:create-super-admin

# 3. Access Super Admin Portal at http://localhost:5173/super-admin
```

### Complete Demo Environment Reset
```bash
# 1. Reset everything except admins:
npm --prefix backend run db:reset-except-admin

# 2. Reseed demo users, sample exam, and super admin:
npm --prefix backend run db:seed
```
