# Proctora 🛡️

### Real-Time Online Examination System with Proctoring and Suspicious Event Detection

We have added the .env files for convenience. Ideally we should not add them to git.

The site is deployed live at the url: https://proctora-pi.vercel.app/

The first time you load it up, it may take a few seconds as the backend server might be sleeping.

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518.0.0-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-5-orange.svg)](https://svelte.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)

---

> **Looking for the Complete Master Setup & Operations Guide?**
> Read [`docs/MASTER_SETUP_AND_ARCHITECTURE_GUIDE.md`](file:///home/harshith/dev/Proctora/docs/MASTER_SETUP_AND_ARCHITECTURE_GUIDE.md) for step-by-step installation instructions, environment configs, database maintenance scripts, all 9 system workflow Mermaid diagrams, and the complete 31-endpoint API reference catalog.
> Read [`docs/DATABASE_SCRIPTS.md`](file:///home/harshith/dev/Proctora/docs/DATABASE_SCRIPTS.md) for specialized database maintenance, user flush, super admin provisioning, and log retention scripts.
> Read [`docs/DEPLOYMENT_GUIDE_VERCEL_RENDER.md`](file:///home/harshith/dev/Proctora/docs/DEPLOYMENT_GUIDE_VERCEL_RENDER.md) for complete cloud deployment instructions (Frontend on Vercel, Backend & AI Microservice on Render, Managed PostgreSQL).

---

## 📌 Executive Summary

**Proctora** is an enterprise-grade, real-time online assessment and programming contest platform engineered to guarantee academic integrity in remote and computer-lab examinations. Developed as a Software Engineering Course Project at the **Department of Information Technology, National Institute of Technology Karnataka (NITK), Surathkal**, Proctora delivers a robust, browser-only testing environment with zero client-side installation requirements.

The platform combines continuous automated AI proctoring, sustained temporal behavioral analysis (to minimize false positives), seating-plan-based question shuffling, browser focus and fullscreen lockdown enforcement, frame-by-frame Monaco code editor telemetry streaming, immutable audit logging with a dedicated **Super Admin Dashboard**, and mandatory two-factor authentication with 2FA-secured self-service password recovery.

---

## 👥 Authors & Academic Context

- **Adarsh Bellamane** (241IT004)
- **Harshith Vellapha** (241IT033)
- **Rushi Hiren Patel** (241IT065)

**Course Mentor:** Dr. Jaidhar C.D.
**Institution:** Department of Information Technology, National Institute of Technology Karnataka, Surathkal
**Project:** Software Engineering Course Project
**Specification Version:** 2.0 (Based on IEEE Std 830-1998 SRS & DFD/Structure Chart Specifications)

---

## 🚀 Key Features

### 🔐 1. Authentication, Security & Password Policies

- **Dynamic Password Strength Detector:** Real-time visual feedback meter embedded directly into registration and password reset workflows. Evaluates:
  - At least one special character (`[!@#$%^&*(),.?":{}|<>]`)
  - At least one numeric digit (`[0-9]`)
  - Mixed-case parity: At least one lowercase letter (if uppercase exists) and at least one uppercase letter (if lowercase exists).
  - Color-coded indicator: **Red** (0 met), **Orange** (1–2 met), **Green** (all 3 met).
- **Compulsory Two-Factor Authentication (2FA):** Mandatory TOTP registration (RFC 6238) during initial account creation. Students cannot bypass 2FA setup.
- **2FA-Powered Password Recovery:** Self-service password recovery reusing the candidate's existing authenticator app. Verifying the 6-digit TOTP code issues a cryptographically signed, short-lived (15-min) reset token authorizing password change on `/reset-password`.
- **Role-Based Access Control (RBAC):** Strictly separated authorization domains:
  - `CANDIDATE`: Access to device check, time-gated examination player, and submission portal.
  - `ADMIN`: Test creation, question authoring, seating plans, accommodations, and live invigilation monitor.
  - `SUPER_ADMIN`: System-wide audit event ledger, multi-dimensional search/filter console, and data export.

### 📜 2. Centralized Event Logging & Audit Trail

- **Dedicated `logs` Table:** Independent database model recording critical actions across candidates and exam creators:
  - `sign_up`, `sign_in`, `log_out`, `2fa_setup`, `password_reset`, `admin_create`
  - `test_create`, `test_edit`, `test_delete`
  - `test_attempt`, `test_finish`
  - `fullscreen_exit`, `anomaly_detected`, `auto_logout`
- **Non-Blocking Asynchronous Ingestion:** Built-in [`backend/src/lib/eventLogger.ts`](file:///home/harshith/dev/Proctora/backend/src/lib/eventLogger.ts) resolves IP addresses, user agents, user metadata, and structured JSON context asynchronously without impacting user request latency.

### 🛡️ 3. Decoupled Super Admin Dashboard (`/super-admin`)

- **Real-Time Log Stream:** Live auto-refreshing audit table (8-second polling) displaying all platform activities.
- **Multi-Dimensional Filters:** Filter dynamically by Event Type, Username, Email, and Date Ranges without full page reloads.
- **Metric Cards:** High-level analytics counters for Total Events, Security & Auth actions, Exam activities, and Integrity Violations.
- **Inspection & Compliance Export:** High-contrast JSON modal viewer for raw payload inspection and one-click sanitized CSV log export.
- **Full Architectural Isolation:** Dedicated view layer that never couples with candidate or exam creator workflows.

### 💻 4. Pre-Flight Device Diagnostics

- **Automated Hardware Checks:** Live diagnostics for webcam video feed, microphone audio capture, supported browser versions, and bandwidth adequacy.
- **Remediation Guidance:** Clear troubleshooting suggestions if devices are inaccessible or below operational thresholds.

### 🪑 5. Seating-Plan-Aware Question Shuffling

- **Physical Seating Deconfliction:** Upload classroom seating maps (`.csv` format with row/column coordinates) to guarantee adjacent candidates receive non-identical question sequences or question pools.
- **Standard Randomization:** Fallback pseudo-random shuffling for remote or unstructured testing scenarios.

### 👁️ 6. AI Proctoring with False-Positive Suppression

- **Temporal Behavioral Windows:** Evaluates behavioral signals across rolling time windows rather than triggering on single-frame anomalies (e.g., natural blinks or momentary glances).
- **Multi-Signal Analysis:** Detects gaze diversion, abnormal head poses, absence of candidate, and presence of unauthorized multiple faces.
- **Confidence Scoring & Real-Time Alerting:** Calculates an aggregate cheating-probability score and transmits alerts instantly to invigilators via WebSockets.

### ⌨️ 7. Monaco Code Telemetry & Replay Player

- **Contest-Grade Keystroke Logging:** Records granular typing operations, text deltas, paste volume anomalies, and execution events.
- **Serialized Timeline:** Faculty can scrub through an interactive, frame-by-frame code evolution replay synchronized with proctoring infraction timestamps.

### 🔒 8. Lockdown & Session Integrity

- **Browser Focus Monitoring:** Tracks window blurs, tab switching, and minimized states with timestamped infraction logs.
- **Native Fullscreen Enforcement:** Enforces browser Fullscreen API; flags and logs every exit attempt.
- **Inactivity Auto-Logout:** Bounded idle-timeout terminates abandoned sessions, flags them for review, and frees exam seats.
- **Candidate Accommodations:** Administrators can assign verified accommodations (e.g., extended time multipliers) that adjust exam timers dynamically.
- **Fault-Tolerant Autosave:** Continual background persistence of candidate responses to prevent data loss during transient network interruptions.

---

## 📐 System Architecture

Proctora adheres strictly to a **Decoupled Client-Server Architecture** communicating via RESTful JSON APIs and full-duplex WebSockets over TLS.

```text
                  ┌─────────────────────────────────────────────────────────┐
                  │                    Candidate Client                     │
                  │  (Svelte 5 + WebRTC getUserMedia + Fullscreen/Focus API)│
                  └────────────────────────────┬────────────────────────────┘
                                               │ HTTPS / WSS
                                               ▼
┌───────────────────────┐         ┌─────────────────────────┐         ┌────────────────────────┐
│  Administrator Client │◄───────►│     Proctora Backend    │◄───────►│  PostgreSQL Database   │
│  (Live Monitor,       │ HTTPS / │  (Express 5, TypeScript,│ Prisma  │  (Users, Exams, Plans, │
│   Playback, Analytics)│  WSS    │   WebSocket Server, Zod)│  ORM    │   Responses, Telemetry,│
└───────────────────────┘         └────────────┬────────────┘         │   Audit Logs)          │
                                               │                      └────────────────────────┘
┌───────────────────────┐                      │
│  Super Admin Client   │◄─────────────────────┘
│  (Real-Time Audit Log,│ HTTPS
│   Filter & CSV Export)│
└───────────────────────┘
```

### Module Organization

The backend is structured into modular domain packages conforming to the IEEE SRS and DFD specifications:

| Module                    | Route Mount        | Description                                                                                                                                  |
| :------------------------ | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **`auth`**                | `/api/auth`        | User registration with password policy, Argon2 hashing, compulsory TOTP 2FA, 2FA-backed password recovery, JWT sessions, and admin creation. |
| **`superAdmin`**          | `/api/super-admin` | Decoupled Super Admin auditing engine. Queries `logs` table with multi-dimensional filtering, pagination, and statistical aggregations.      |
| **`examConfig`**          | `/api/exams`       | Question bank creation, CSV classroom seating plan coordinates, and candidate accommodations.                                                |
| **`examDelivery`**        | `/api/exams`       | Device diagnostics, fullscreen lockdown, dynamic question delivery, and timer management.                                                    |
| **`integrityMonitoring`** | `/api/exams`       | Video AI analysis, focus tracking, editor telemetry streaming, alert broadcasts, and idle auto-logout.                                       |
| **`evaluationExport`**    | `/api/exams`       | Periodic response autosaving, finalized exam submission, auto-grading, and CSV/PDF report compilation.                                       |

---

## 🛠️ Technology Stack

### Backend

- **Runtime:** Node.js (v18+)
- **Framework:** Express 5 with TypeScript
- **ORM & Database:** Prisma 7 + PostgreSQL (via `@prisma/adapter-pg`)
- **Real-Time Communication:** `ws` (WebSockets)
- **Authentication & Cryptography:** JWT (`jsonwebtoken`), Argon2id (`argon2`), TOTP (`otplib`, `speakeasy`), AES-256-GCM encryption
- **Security Middleware:** Helmet, CORS, CSRF (`csrf-csrf`), Rate Limiting (`express-rate-limit`), Cookie Parser
- **Schema Validation:** Zod
- **Event Logging:** Built-in asynchronous eventLogger emitting to indexed PostgreSQL `logs` table

### Frontend

- **Framework:** Svelte 5 (Vite-powered Single Page Application)
- **Language:** TypeScript
- **Routing:** `svelte-spa-router`
- **Code Editor:** Monaco Editor (keystroke telemetry capture)
- **Networking:** Axios + Native WebSockets (`ws://` / `wss://`)
- **Browser APIs:** Fullscreen API, Page Visibility API, MediaDevices (`getUserMedia`), Window Focus/Blur

---

## 📂 Repository Structure

```text
Proctora/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # Prisma database schema (Users, Exams, Logs, etc.)
│   │   ├── seed.ts                 # Default seed script (Admin, Super Admin, Morgan Stanley OA)
│   │   └── seed_morgan_stanley.ts  # Morgan Stanley OA test fixtures
│   ├── src/
│   │   ├── config/                 # Environment and application configuration
│   │   ├── lib/                    # Shared utilities (DB client, crypto, eventLogger)
│   │   ├── middleware/             # Auth guards, role checks, CSRF, rate limiters
│   │   ├── modules/
│   │   │   ├── auth/               # Module 1.0: 2FA, registration, password recovery
│   │   │   ├── superAdmin/         # Super Admin audit log viewer & filter API
│   │   │   ├── examConfig/         # Module 2.0: Question banks & seating plans
│   │   │   ├── examDelivery/       # Module 3.0: Device checks & exam player
│   │   │   ├── integrityMonitoring/# Module 4.0: AI proctoring & telemetry
│   │   │   └── evaluationExport/   # Module 5.0: Scoring & CSV/PDF export
│   │   ├── routes/                 # Aggregated API routes (/api/*)
│   │   ├── scripts/                # Database maintenance & administrative CLI tools
│   │   │   ├── createSuperAdmin.ts # Interactive / CLI Super Admin creator
│   │   │   ├── flushLogs.ts        # Retention cleaner for audit logs
│   │   │   ├── flushNonAdminUsers.ts
│   │   │   └── resetDatabaseExceptAdmin.ts
│   │   ├── app.ts                  # Express application setup & middleware stack
│   │   └── server.ts               # Server bootstrapping & WebSocket attach
│   ├── DATABASE_SCRIPTS.md         # Database maintenance reference
│   ├── .env.example                # Backend environment template
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/             # Reusable UI components
│   │   │   ├── auth/
│   │   │   │   ├── PasswordStrengthIndicator.svelte  # 3-rule visual strength meter
│   │   │   │   ├── LoginForm.svelte
│   │   │   │   └── RegisterForm.svelte
│   │   ├── lib/                    # API client, WebSocket helpers, utilities
│   │   ├── pages/                  # Application views
│   │   │   ├── LoginPage.svelte
│   │   │   ├── RegisterPage.svelte
│   │   │   ├── ForgotPasswordPage.svelte # 2FA verification for password reset
│   │   │   ├── ResetPasswordPage.svelte  # New password entry with strength meter
│   │   │   ├── TwoFactorSetupPage.svelte # Mandatory TOTP configuration
│   │   │   ├── SuperAdminPage.svelte     # Decoupled Super Admin Audit Console
│   │   │   ├── DashboardPage.svelte
│   │   │   ├── DeviceCheckPage.svelte
│   │   │   ├── ExamPortalPage.svelte
│   │   │   ├── ExamSubmittedPage.svelte
│   │   │   ├── AdminExamsPage.svelte
│   │   │   └── AdminMonitorPage.svelte
│   │   ├── stores/                 # Svelte reactive state stores (auth, exam)
│   │   ├── App.svelte              # Main router & page layout
│   │   ├── app.css                 # Global styling & layout definitions
│   │   └── main.ts
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                           # SRS, DFDs, Database Guides, Architecture Guide
│   ├── DATABASE_SCRIPTS.md
│   └── MASTER_SETUP_AND_ARCHITECTURE_GUIDE.md
├── test/                           # Automated test suites & verification runners
│   ├── unit/backend/               # Express, Auth, Super Admin & Log tests
│   ├── unit/ai/                    # AI proctoring & temporal window tests
│   ├── unit/frontend/              # Svelte unit tests
│   └── run_tests.sh                # Unified test runner
└── README.md
```

---

## ⚙️ Installation & Setup Guide

### Prerequisites

- **Node.js**: v18.0.0 or later
- **npm**: v9.0.0 or later
- **PostgreSQL**: v14 or later (running locally or accessible via Docker)

---

### 1. Clone the Repository

```bash
git clone https://github.com/harshithv25/Proctora.git
cd Proctora
```

---

### 2. Backend Setup

1. **Install dependencies:**

   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

   Configure your PostgreSQL connection and encryption keys:

   ```dotenv
   NODE_ENV=development
   PORT=4000
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/proctora?schema=public"

   JWT_ACCESS_SECRET="your_super_secret_access_jwt_key_here_32_chars"
   JWT_REFRESH_SECRET="your_super_secret_refresh_jwt_key_here_32_chars"
   JWT_ACCESS_TTL="15m"
   JWT_REFRESH_TTL="7d"

   AES_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
   CSRF_SECRET="csrf_secret_key_minimum_32_bytes_long_string!"

   TOTP_ISSUER="NITK-Proctora"
   CLIENT_URL="http://localhost:5173"
   ```

3. **Database Migration & Seed:**

   ```bash
   # Push schema to database
   npm run db:push

   # Seed default users (Admin, Super Admin, Student) & sample exam
   npm run seed
   ```

4. **Start the Backend Server:**
   ```bash
   npm run dev
   ```
   The backend API will run at `http://localhost:4000`.

---

### 3. Frontend Setup

1. **In a separate terminal, install dependencies:**

   ```bash
   cd frontend
   npm install
   ```

2. **Start the Frontend Development Server:**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

---

## 🔑 Default Credentials & Roles

| Role                        | Email                     | Password           | Access URL                          | Capabilities                                                                         |
| :-------------------------- | :------------------------ | :----------------- | :---------------------------------- | :----------------------------------------------------------------------------------- |
| **Super Administrator**     | `superadmin@proctora.edu` | `SuperAdmin@12345` | `http://localhost:5173/super-admin` | Full system audit trail, multi-dimensional log search, CSV export, telemetry review  |
| **Administrator / Faculty** | `admin@proctora.edu`      | `Admin@12345`      | `http://localhost:5173/admin/exams` | Test authoring, seating plans, accommodations, live invigilation monitor, grading    |
| **Candidate / Student**     | `student@proctora.edu`    | `Student@12345`    | `http://localhost:5173/dashboard`   | Device diagnostics, examination portal (`TEST-MS2026`), code editor, response submit |

---

## 🗄️ Database Management & Administrative Scripts

All administrative and database scripts can be executed directly via npm in the `backend/` directory:

| npm Command                     | Script Target                                                                                                                           | Description                                                                                                              |
| :------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| `npm run db:create-super-admin` | [`backend/src/scripts/createSuperAdmin.ts`](file:///home/harshith/dev/Proctora/backend/src/scripts/createSuperAdmin.ts)                 | Provisions a new Super Admin account with email, name, and strong password validation.                                   |
| `npm run db:flush-logs`         | [`backend/src/scripts/flushLogs.ts`](file:///home/harshith/dev/Proctora/backend/src/scripts/flushLogs.ts)                               | Flushes old event logs from the `logs` table (supports optional retention: `npm run db:flush-logs 30`).                  |
| `npm run db:reset-except-admin` | [`backend/src/scripts/resetDatabaseExceptAdmin.ts`](file:///home/harshith/dev/Proctora/backend/src/scripts/resetDatabaseExceptAdmin.ts) | Wipes all test fixtures, seating plans, submissions, and telemetry while **preserving all ADMIN and SUPER_ADMIN users**. |
| `npm run db:flush-non-admin`    | [`backend/src/scripts/flushNonAdminUsers.ts`](file:///home/harshith/dev/Proctora/backend/src/scripts/flushNonAdminUsers.ts)             | Removes all candidate profiles while retaining administrators.                                                           |
| `npm run seed:oa`               | [`backend/prisma/seed_morgan_stanley.ts`](file:///home/harshith/dev/Proctora/backend/prisma/seed_morgan_stanley.ts)                     | Seeds the complete Morgan Stanley OA test environment with 10 questions and desk mappings.                               |

---

## 🧪 Testing & Verification

Proctora includes a comprehensive test suite covering backend logic, AI proctoring temporal filters, frontend components, and security controls:

```bash
# Run all automated tests from the repository root
bash test/run_tests.sh
```

### Test Coverage Highlights:

- **Backend Unit Tests (45 passing):** Auth token rotation, CSRF validation, Super Admin log filtering, 2FA password reset flow, and exam scoring.
- **AI Proctoring Tests (19 passing):** Temporal window smoothing, blink suppression, sustained gaze deflection thresholds, and head pose heuristics.
- **Frontend Tests (25 passing):** Svelte component rendering, Password Strength Meter color transitions, and store state machines.
- **Integration Tests (6 passing):** Full end-to-end API lifecycle flows.

---

## 📋 Functional Requirements Matrix (IEEE Std 830-1998)

| ID       | Requirement Name                     | Description                                                                                                                                                            | Priority |
| :------- | :----------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| **F.1**  | **User Registration & 2FA**          | Candidate registration, Argon2 password storage, mandatory TOTP two-factor authentication, session token issuance, account lockout on brute force.                     | High     |
| **F.2**  | **Password Strength & 2FA Recovery** | Real-time 3-rule password strength meter (special char, digit, mixed-case); self-service password recovery authorized via 2FA TOTP verification.                       | High     |
| **F.3**  | **Centralized Event Logging**        | Asynchronous recording of all critical platform actions (`sign_up`, `test_create`, `test_attempt`, `test_finish`, `anomaly_detected`, etc.) into indexed `logs` table. | High     |
| **F.4**  | **Super Admin Audit Dashboard**      | Decoupled `/super-admin` console with live 8s polling, multi-dimensional event/user filtering, JSON detail viewer, and CSV audit export.                               | High     |
| **F.5**  | **Device Compatibility Check**       | Pre-flight diagnostics for webcam, microphone, network throughput, and browser feature support with remediation steps.                                                 | High     |
| **F.6**  | **Seating-Based Question Shuffling** | Parsing row/col seating charts to distribute non-overlapping or distinct question orders to adjacent candidates; optional standard pool shuffling.                     | High     |
| **F.7**  | **AI Proctoring Pipeline**           | Continuous video analysis with rolling temporal windows to suppress momentary false-positive alerts while detecting gaze anomalies, absence, or extra persons.         | High     |
| **F.8**  | **Code Telemetry Capture**           | Granular capture of Monaco editor keystrokes,, text deltas, paste anomalies, and code runs for post-exam scrubbing and replay playback.                                | Medium   |
| **F.9**  | **Browser Focus Tracking**           | Real-time logging of tab blurs, window minimizations, and lost visibility events with aggregated infraction counters.                                                  | Medium   |
| **F.10** | **Response Autosave & Collection**   | Periodic in-flight response synchronization to cloud storage and atomic collection on manual submit or timer expiration.                                               | High     |
| **F.11** | **Real-Time Proctoring Alerts**      | Instant WebSocket notifications pushed to the Admin Dashboard when candidate infraction scores cross configurable thresholds.                                          | Medium   |
| **F.12** | **Results & Report Export**          | Aggregation of candidate scores, proctoring timeline flags, and telemetry into downloadable CSV and PDF reports.                                                       | Low      |
| **F.13** | **Fullscreen Enforcement**           | Mandatory activation of browser Fullscreen API prior to exam start; detection and logging of all exit attempts.                                                        | Medium   |
| **F.14** | **Candidate Accommodations**         | Administrator management of individual accommodations (e.g. extra time multipliers), dynamically updating exam session timers.                                         | Medium   |
| **F.15** | **Inactivity Auto-Logout**           | Automatic termination of abandoned or idle sessions beyond a strict threshold, freeing exam seats and flagging sessions for review.                                    | Medium   |

---

## 🔒 Security & Compliance

- **Decoupled Architecture:** Strict separation of client presentation and server validation logic prevents unauthorized state modification.
- **Encrypted Communications:** All transit occurs over TLS/HTTPS and WSS protocols.
- **Session Integrity & Anti-CSRF:** Hardened cookie handling (`SameSite`, `HttpOnly`), Double-Submit CSRF tokens, and short-lived JWT access tokens paired with rotatable refresh tokens.
- **Compulsory 2FA:** Candidates and administrators are protected by RFC 6238 TOTP authenticator requirements.
- **Data Retention & Purging:** Automated data purging policies (`flushLogs.ts`) ensure telemetry and video frames are retained only during the institutional review window.
- **Audit Trail:** Immutable centralized logging of all exam creations, edits, attempts, security anomalies, and administrative overrides.

---

## 📄 License

This project is licensed under the **ISC License**. See the `LICENSE` file for full terms.
