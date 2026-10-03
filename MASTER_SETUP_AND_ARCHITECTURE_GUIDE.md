# Proctora: Master Setup, Architecture & Operations Guide

> **Audience**: Software Engineers, Instructors, and System Administrators deploying or developing Proctora on Linux, macOS, or Windows (WSL2).  
> **Repository Root**: [`/home/harshith/dev/Proctora`](file:///home/harshith/dev/Proctora)

---

## 1. System Overview & Technology Stack

**Proctora** is an enterprise-grade, high-integrity online examination and proctoring platform designed for institutional technical assessments, recruitment tests, and university examinations.

### High-Level Architecture Stack

| Domain | Technology | Key Libraries & Specifications |
| :--- | :--- | :--- |
| **Backend Core** | Node.js (v20+), Express.js (v5.x), TypeScript | Strict type safety, clean layered controller-service architecture |
| **Database & ORM** | PostgreSQL (v14+), Prisma ORM (v7.x) | Automated schema generation, relational migrations, connection pooling |
| **Security & Auth** | Argon2, JWT (Access + Refresh), TOTP, AES-256-GCM | HTTP-only cookies, Double Submit CSRF, rate limiters, AES field-level encryption |
| **Real-Time Streaming** | WebSockets (`ws`), WebRTC Client Streams | Instant anomaly alerts, candidate live progress streaming |
| **Code Assessment** | Microsoft Monaco Editor (VS Code core engine) | Syntax highlighting, real-time typing telemetry, blur/paste tracking |
| **Frontend Core** | Svelte 5 (Runes architecture), Vite, TypeScript | Modern reactive state management, lightning fast HMR |
| **Styling & Design** | Vanilla CSS custom properties (Design Tokens) | Clean warm-stone aesthetic, zero third-party UI framework bloat |
| **Testing & Quality** | Playwright Chromium Engine, tsx runner | Headless end-to-end user emulation, screenshot verification |

---

## 2. Prerequisites & Environment Requirements

Before cloning and running Proctora on any machine, verify the host system meets the following prerequisites:

1. **Node.js**: `v20.x` or `v22.x` LTS ([Download Node.js](https://nodejs.org/)). Verify with:
   ```bash
   node -v
   npm -v
   ```
2. **PostgreSQL**: `v14.0` or higher running locally on default port `5432`.
   - **Alternative (Docker 1-Liner)**:
     ```bash
     docker run --name proctora-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=proctora -p 5432:5432 -d postgres:16-alpine
     ```
3. **Webcam & Microphone**: Required on the candidate machine to pass automated device checks and stream proctoring telemetry.
4. **Operating System**: Linux (Ubuntu 22.04/24.04 recommended), macOS (Apple Silicon or Intel), or Windows 10/11 using **WSL2** (Ubuntu).

---

## 3. Step-by-Step Installation & Setup

### Step 1: Clone the Repository

```bash
git clone <repository-url> Proctora
cd Proctora
```

---

### Step 2: Backend Setup & Configuration

Navigate to the `backend/` directory, install packages, and set up the environment variables:

```bash
cd backend
npm install
```

Create `backend/.env` (or copy from below):

```env
# Server Mode & Port
NODE_ENV=development
PORT=4000

# PostgreSQL Connection String
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/proctora

# JWT Authentication Secrets (minimum 32 characters each)
JWT_ACCESS_SECRET=dev_access_secret_change_me_in_production_32chars
JWT_REFRESH_SECRET=dev_refresh_secret_change_me_in_production_32ch
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# AES-256-GCM Symmetric Key (must be exactly 64 hex characters = 32 bytes)
AES_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# CSRF Cookie Secret (minimum 32 characters)
CSRF_SECRET=dev_csrf_secret_change_me_in_production_32chars

# TOTP 2FA Issuer Name
TOTP_ISSUER=NITK-OnlineExam

# Allowed Frontend URL for CORS & Cookies
CLIENT_URL=http://localhost:5173
```

---

### Step 3: Database Schema Migration & Seeding

Synchronize your PostgreSQL database with the Prisma schema and seed initial accounts:

```bash
# Push Prisma schema to Postgres and generate the client
npx prisma db push
npx prisma generate

# Seed initial system administrator and student accounts
npm run db:seed

# Seed the comprehensive 10-question "Morgan Stanley OA" assessment
npm run seed:oa
```

---

### Step 4: Frontend Setup & Configuration

Open a new terminal window, navigate to `frontend/`, install packages, and configure environment variables:

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
# API Base Endpoint (proxied by Vite to http://localhost:4000/api)
VITE_API_BASE_URL=/api

# WebSocket Server Endpoint
VITE_WS_URL=ws://localhost:4000/ws
```

---

### Step 5: Python Live AI Proctoring Service Setup

Navigate to the `ai-service/` directory and activate the virtual environment:

```bash
cd ai-service
# The virtual environment is provisioned at ./venv
source venv/bin/activate

# (Optional) Retrain or calibrate the cheat classification model
python train_model.py

# Start the AI Proctoring FastAPI microservice
uvicorn main:app --host 0.0.0.0 --port 5001 --reload
```

---

### Step 6: Launching Development Servers

Run all three services concurrently:

**Terminal 1 — Backend API & WebSocket Server:**
```bash
cd backend
npm run dev
# Running on http://localhost:4000 (API) and ws://localhost:4000/ws (WebSocket)
```

**Terminal 2 — Frontend Application:**
```bash
cd frontend
npm run dev
# Running on http://localhost:5173
```

**Terminal 3 — Python Live AI Proctoring Microservice:**
```bash
cd ai-service
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 5001
# Running on http://localhost:5001
```

Now open `http://localhost:5173` in your browser.

---

## 4. Default Credentials & Test Fixtures

When initialized with `npm run db:seed` and `npm run seed:oa`, the system provisions the following accounts and tests:

### User Credentials

| Role | Email | Password | Roll Number | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Administrator** | `admin@proctora.edu` | `Admin@12345` | *N/A* | Exam Studio, Classroom Matrix, Live Invigilation & Leaderboard |
| **Candidate** | `student@proctora.edu` | `Student@12345` | `21CS001` | Candidate Minimalist Portal, Exam Taking, Monaco Code Editor |

### Default Assessment: Morgan Stanley OA

- **Exam Database ID**: `morgan-stanley-oa-1`
- **Candidate Test ID**: `TEST-MS2026`
- **Direct Candidate Portal URL**: `http://localhost:5173/exams/TEST-MS2026/portal`
- **Direct Admin Invigilation URL**: `http://localhost:5173/admin/exams/TEST-MS2026/monitor`
- **Duration**: 90 Minutes (Total Score: 25 Points)
- **Question Structure**:
  1. `Q1` (MCQ Single): Worst-case time complexity of balanced BST (`O(log N)`) — 1 pt
  2. `Q2` (MCQ Single): HTTP status for missing authentication (`401 Unauthorized`) — 1 pt
  3. `Q3` (MCQ Single): ACID property preventing dirty reads (`Isolation`) — 1 pt
  4. `Q4` (Multi-Correct): Shortest path graph algorithms (Dijkstra, Bellman-Ford, Floyd-Warshall) — 2 pts
  5. `Q5` (Multi-Correct): Valid priority queue / heap implementations (Binary Heap, Fibonacci Heap, Red-Black Tree) — 2 pts
  6. `Q6` (Multi-Correct): Transport Layer characteristics (TCP 3-way, flow control, UDP low overhead) — 2 pts
  7. `Q7` (Coding): Python Two Sum (`two_sum(nums, target)`) in Monaco Editor — 5 pts
  8. `Q8` (Coding): Python Valid Parentheses (`is_valid_parentheses(s)`) in Monaco Editor — 5 pts
  9. `Q9` (Descriptive): Optimistic vs. Pessimistic Concurrency Control — 3 pts
  10. `Q10` (Descriptive): Python Garbage Collection & Reference Counting cycles — 3 pts
- **Seating Allocation**: Desk Row 1, Column 1, Question Set `SET-A` for roll number `21CS001`.

---

## 5. Database Management Scripts

All maintenance operations can be run using pre-configured npm scripts. See [`DATABASE_SCRIPTS.md`](file:///home/harshith/dev/Proctora/DATABASE_SCRIPTS.md) for further technical specifics.

| Command | Working Directory | Description |
| :--- | :--- | :--- |
| `npm run seed:oa` | `backend/` | Cleans up previous responses and seeds the complete 10-question Morgan Stanley OA. |
| `npm run db:reset-except-admin` | `backend/` | Clears all responses, seating, questions, and students, keeping only `admin@proctora.edu`. |
| `npm run db:flush-exams` | `backend/` | Removes all exams and responses while preserving all registered users. |
| `npm run db:flush-users` | `backend/` | Deletes all candidate accounts and sessions while preserving administrator accounts. |
| `npm run db:push` | `backend/` | Pushes Prisma schema changes directly to the PostgreSQL database without migrations. |
| `npm run db:studio` | `backend/` | Opens Prisma Studio web GUI on `http://localhost:5555` to browse tables visually. |

---

## 6. Architecture & Module Specifications

Proctora is partitioned into 5 decoupled backend modules located in [`backend/src/modules/`](file:///home/harshith/dev/Proctora/backend/src/modules):

```
backend/src/modules/
├── auth/                 # Identity, sessions, Argon2 hashing, TOTP 2FA, RBAC
├── examConfig/           # Exam authoring, questions, CSV seating matrices, accommodations
├── examDelivery/         # Time-gating enforcement, candidate portal, device checks, fullscreen lock
├── integrityMonitoring/  # Webcam frame flags, tab blurs, focus logs, Monaco telemetry
└── evaluationExport/     # Autosave drafts, strict auto-grading, admin live feed, leaderboard, CSV export
```

### Module 1: Authentication & Authorization (`auth`)
- **Password Security**: Uses **Argon2id** algorithm with high memory-cost parameters.
- **Tokens**: Short-lived JWT Access Tokens (15 min) paired with HTTP-only Refresh Token Cookies (7 days) stored in the `Session` database table.
- **Multi-Factor Authentication (TOTP)**: Built with `otplib`. Generates standard `otpauth://` QR-compatible secrets. Required for high-privilege operations.
- **Brute-Force Lockout**: Automatically locks an account after 5 consecutive failed login attempts (`isLocked: true`).
- **Role-Based Access Control (RBAC)**: Enforced via `requireRole("ADMIN")` or `requireRole("CANDIDATE")` route middleware.

### Module 2: Exam Configuration Studio & Seating Planner (`examConfig`)
- **Exam Management**: Creation, updating, and deletion of exams with start time, end time, duration limit, and idle timeouts.
- **Question Studio**: Supports 4 distinct question types:
  - `MCQ_SINGLE`: Single-choice questions with options array and single string answer.
  - `MCQ_MULTI`: Multi-correct checkboxes with options array and string array of correct solutions.
  - `CODING`: Monaco editor prompt with starter code templates, language target (`python`, `javascript`, `cpp`), and test cases.
  - `DESCRIPTIVE`: Long-form conceptual questions with rich text explanations.
- **Seating Matrix Ingestion**: Accepts CSV classroom grids (`rollNumber,seatRow,seatCol,questionSetId`), automatically assigning randomized question sets (`SET-A`, `SET-B`) to prevent neighbor cheating.
- **Accommodations**: Grants extended exam duration to specific candidates (e.g. extra 30 minutes for accessibility needs).

### Module 3: Exam Delivery & Time-Gating Engine (`examDelivery`)
- **Strict Server-Side Time-Gating**:
  - Entry is allowed strictly **1 minute prior** to `startTime` (`now >= startTime - 60s`).
  - Pre-window requests reject with `TIME_GATE_EARLY`, returning exact `secondsUntilOpen`.
  - Post-window requests reject with `TIME_GATE_EXPIRED`.
  - Frontend renders a locked countdown screen or expiration notification accordingly.
- **Candidate Terminal**: Minimalist single-purpose dashboard accepting pure Test IDs (`TEST-MS2026`) or full exam links and redirecting to `/exams/:testId/portal`.
- **Device Verification**: Enforces webcam and microphone accessibility check prior to test seating.
- **Fullscreen Enforcement**: Listens for fullscreen exit events and records security telemetry.

### Module 4: Integrity Monitoring & Monaco Telemetry (`integrityMonitoring`)
- **Focus Tracking**: Captures window `blur`, `focus`, and tab-switch timestamps in `FocusLog`.
- **Computer Vision Anomaly Ingestion**: Collects periodic frame scores, head gaze deviations, and absence flags, persisting encrypted event payload via AES-256-GCM.
- **Monaco Code Telemetry**:
  - Live tracking of total keystrokes, paste event counts, and editor blur events.
  - Telemetry counters are saved in `EditorTelemetryEvent` and transmitted on autosave and final submission.
- **WebSocket Gateway**: `/ws` broadcast pipe for instant anomaly delivery to admin monitor consoles.

### Module 5: Evaluation, Auto-Grading & Post-Exam Analytics (`evaluationExport`)
- **Continuous Autosave**: Client periodically flushes draft answers every 10 seconds or on question change. Draft answers are preserved in PostgreSQL `ExamResponse`.
- **Strict Auto-Grading Rules** ([`grading.ts`](file:///home/harshith/dev/Proctora/backend/src/modules/evaluationExport/grading.ts)):
  - **Single MCQ**: Exactly matches `correctAnswer` = Full points; otherwise 0 points.
  - **Multi-Correct**: **Strict all-or-nothing**. Candidate selections must match `correctAnswers` identically with zero missing choices and zero extraneous choices = Full points; otherwise 0 points.
  - **Coding & Descriptive**: 0 points (Ungraded / Marked as `Pending Manual Instructor Review`).
- **Score Visibility Gating**:
  - Auto-graded scores are **hidden from instructors and invigilators** during the active test window to prevent grading bias.
  - Automatically unmasked once the scheduled test window concludes or all assigned candidates have submitted.
- **Post-Exam Leaderboard & Analytics**:
  - Instant ranking of candidates by final score and completion duration.
  - Sortable by: *Highest Score*, *Lowest Score*, *Fastest Finish*, and *Slowest Finish*.
- **Candidate Answer Sheet Viewer**:
  - Interactive modal displaying student answers side-by-side with expected solutions.
  - Color-coded validation pills (`+1 pts (Correct)`, `0 pts (Incorrect)`, `Pending Review`).
  - Read-only Monaco code viewer displaying submitted implementation and telemetry statistics.

---

## 7. System Architecture & Workflows (Mermaid Diagrams)

### Workflow 1: End-to-End System Architecture

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Layer (Svelte 5 + Runes)"]
        CP["Candidate Terminal (/dashboard)"]
        EP["Exam Portal & Monaco Editor (/exams/:id/portal)"]
        DC["Device Check (/device-check)"]
        AM["Admin Live Invigilation Feed (/admin/exams/:id/monitor)"]
        ES["Exam Studio (/admin/exams)"]
    end

    subgraph SecurityMiddleware ["Express Security & Policy Pipeline"]
        CORS["CORS & Cookie Parser"]
        RATE["Rate Limiters (Auth / API Limiter)"]
        CSRF["Double-Submit CSRF Verification"]
        AUTH["JWT Authentication Guard"]
        RBAC["Role-Based Access Control (Admin / Candidate)"]
        TIME["Strict Time-Gating Engine (startTime - 60s)"]
    end

    subgraph CoreModules ["Backend Functional Modules"]
        M1["Auth Module (Argon2, TOTP, Sessions)"]
        M2["Exam Config Module (Questions, Seating CSV)"]
        M3["Exam Delivery Module (Device Check, Session Config)"]
        M4["Integrity Monitoring (Focus Logs, Video Flags)"]
        M5["Evaluation Engine (Autosave, Strict Grading, Leaderboard)"]
    end

    subgraph PersistenceLayer ["Database & Realtime Layer"]
        PRISMA["Prisma ORM Client"]
        PG[("PostgreSQL Database")]
        WS["WebSocket Server (/ws)"]
    end

    CP & EP & DC & AM & ES --> CORS
    CORS --> RATE --> CSRF --> AUTH --> RBAC
    RBAC --> TIME
    TIME --> M1 & M2 & M3 & M4 & M5
    M1 & M2 & M3 & M4 & M5 --> PRISMA
    PRISMA --> PG
    M4 & M5 -.-> WS
    WS -.-> AM
```

---

### Workflow 2: Authentication & 2FA Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Candidate / Admin)
    participant Front as Frontend (Svelte Store)
    participant AuthMod as Auth Controller & Service
    participant DB as PostgreSQL (Prisma)

    User->>Front: Enter Email & Password
    Front->>AuthMod: POST /api/auth/login { email, password }
    AuthMod->>DB: Query User by Email
    DB-->>AuthMod: User Record & Password Hash
    AuthMod->>AuthMod: Verify Argon2 Password Hash
    alt Password Mismatch
        AuthMod->>DB: Increment failedLoginAttempts
        AuthMod-->>Front: 401 Unauthorized (Invalid credentials)
    else Password Match
        AuthMod->>DB: Reset failedLoginAttempts = 0
        alt 2FA is Enabled on Account
            AuthMod-->>Front: 200 OK { require2fa: true, tempToken }
            User->>Front: Enter 6-digit TOTP code
            Front->>AuthMod: POST /api/auth/login { code, tempToken }
            AuthMod->>AuthMod: otplib.verify(code, totpSecret)
        end
        AuthMod->>DB: Create Session & Refresh Token
        AuthMod-->>Front: Set HTTP-Only Refresh Cookie + Return Access Token & User Info
        Front->>Front: Redirect to /dashboard
    end
```

---

### Workflow 3: Instructor Exam Authoring & Seating Matrix Ingestion

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Instructor / Admin
    participant Studio as Exam Studio (/admin/exams)
    participant ConfigMod as Exam Config Controller
    participant DB as PostgreSQL (Prisma)

    Admin->>Studio: Define Exam (Title, Time Window, Duration, Idle Timeout)
    Studio->>ConfigMod: POST /api/exams { title, startTime, endTime, duration }
    ConfigMod->>DB: Create Exam Record
    DB-->>ConfigMod: Exam created with generated testId

    Admin->>Studio: Configure Questions (MCQ, Multi-Correct, Coding, Descriptive)
    Studio->>ConfigMod: POST /api/exams/:id/questions { questions: [...] }
    ConfigMod->>DB: Batch Insert Questions with Metadata & Points

    Admin->>Studio: Upload Classroom Seating CSV (Roll Numbers, Row, Col)
    Studio->>ConfigMod: POST /api/exams/:id/seating-plan/csv { csvContent }
    ConfigMod->>ConfigMod: Parse Matrix & Alternate Question Sets (SET-A, SET-B)
    ConfigMod->>DB: Create SeatingAssignments for all candidates
    DB-->>Studio: Seating Matrix Ingested & Desks Mapped
```

---

### Workflow 4: Candidate Access, Strict Time-Gating & Pre-Exam Waiting

```mermaid
sequenceDiagram
    autonumber
    actor Student as Candidate (student@proctora.edu)
    participant Dash as Candidate Minimalist Portal
    participant Portal as Exam Portal Page
    participant Delivery as Exam Delivery Service
    participant DB as PostgreSQL (Prisma)

    Student->>Dash: Paste Test ID ("TEST-MS2026") or URL
    Dash->>Portal: Redirect to /exams/TEST-MS2026/portal
    Portal->>Delivery: GET /api/exams/TEST-MS2026/session-config
    Delivery->>DB: Query Exam, SeatingAssignment, and Accommodations

    alt Current Time < (startTime - 60 seconds)
        Delivery-->>Portal: 200 OK { canEnter: false, isEarly: true, secondsUntilOpen }
        Portal->>Student: Display Locked Countdown Screen (Auto-refreshes when open)
    else Current Time > endTime
        Delivery-->>Portal: 200 OK { canEnter: false, isExpired: true }
        Portal->>Student: Display Examination Concluded / Expired Notice
    else Within Allowed Window (now >= startTime - 60s AND now <= endTime)
        Delivery-->>Portal: 200 OK { canEnter: true, examDetails, assignedDesk }
        Portal->>Delivery: GET /api/exams/TEST-MS2026/questions
        Delivery-->>Portal: 200 OK { questions: [...] } (Answer keys stripped)
        Portal->>Student: Mount Examination Interface with Monaco Editor & Video Feed
    end
```

---

### Workflow 5: Candidate Exam Delivery, Monaco Telemetry & Autosave Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Student as Candidate
    participant Portal as Exam Portal & Monaco
    participant EvalMod as Evaluation Service
    participant IntegMod as Integrity Monitoring Service
    participant DB as PostgreSQL (Prisma)
    participant AdminFeed as Admin Invigilation Feed

    loop Every Keystroke / Paste / Blur
        Student->>Portal: Types code / switches focus
        Portal->>Portal: Update telemetry counters (keys, pastes, blurs)
        Portal->>IntegMod: POST /api/exams/:id/telemetry/editor { eventType, payload }
        IntegMod->>DB: Persist EditorTelemetryEvent
    end

    loop Every 10s or Question Navigation
        Portal->>EvalMod: POST /api/exams/:id/responses/autosave { answers, telemetryStats }
        EvalMod->>DB: Upsert ExamResponse (answers JSON draft)
        EvalMod-.->AdminFeed: Broadcast real-time candidate progress update
    end

    Student->>Portal: Click "Submit Exam" -> Confirm in Modal
    Portal->>EvalMod: POST /api/exams/:id/responses/submit { answers, telemetryStats }
    EvalMod->>EvalMod: Run Strict Auto-Grading Rules
    EvalMod->>DB: Save Final ExamResponse with score & evaluationDetails
    EvalMod-->>Portal: 200 OK { submitted: true, message: "Exam submitted successfully" }
    Portal->>Student: Redirect to /exams/:id/submitted confirmation page
```

---

### Workflow 6: Strict Auto-Grading Engine Execution

```mermaid
flowchart TD
    START(["Exam Submission Received"]) --> LOOP["Iterate Through Exam Questions"]
    
    LOOP --> TYPE{"Question Type?"}
    
    TYPE -->|MCQ_SINGLE| MCQ_CHK{"Candidate Answer == Expected Answer?"}
    MCQ_CHK -->|Yes| MCQ_FULL["Award Full Question Points (e.g. +1 pt)"]
    MCQ_CHK -->|No| MCQ_ZERO["Award 0 Points"]
    
    TYPE -->|MCQ_MULTI| MULTI_CHK{"Candidate Selections == Expected Solutions Exactly?"}
    MULTI_CHK -->|Identical Match No missing, no extra| MULTI_FULL["Award Full Multi-Correct Points (e.g. +2 pts)"]
    MULTI_CHK -->|Any missing or extra wrong choices| MULTI_ZERO["Strict All-Or-Nothing: Award 0 Points"]
    
    TYPE -->|CODING| CODE_UNGRADED["Set Score = 0 pts / Flag as 'Pending Manual Review'"]
    
    TYPE -->|DESCRIPTIVE| DESC_UNGRADED["Set Score = 0 pts / Flag as 'Pending Manual Review'"]
    
    MCQ_FULL & MCQ_ZERO & MULTI_FULL & MULTI_ZERO & CODE_UNGRADED & DESC_UNGRADED --> ACCUM["Accumulate Total Score & Record Question Evaluation Detail Record"]
    
    ACCUM --> MORE{"More Questions?"}
    MORE -->|Yes| LOOP
    MORE -->|No| SAVE[("Persist Final Score & Evaluation JSON to ExamResponse")]
    SAVE --> END(["Grading Completed"])
```

---

### Workflow 7: Real-Time Admin Invigilation Feed & Post-Exam Leaderboard

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Invigilator / Admin
    participant Monitor as Admin Monitor Page (/admin/exams/:id/monitor)
    participant EvalMod as Evaluation Service
    participant DB as PostgreSQL (Prisma)

    Admin->>Monitor: Open Monitor Feed for Exam
    loop Polling / Real-time Sync Every 3 seconds
        Monitor->>EvalMod: GET /api/exams/:id/monitor-feed
        EvalMod->>DB: Query SeatingAssignments, ExamResponses, FocusLogs, EditorTelemetry
        EvalMod->>EvalMod: Check if Active Window Ended or All Candidates Submitted
        alt Exam Still Active & Students Writing
            EvalMod-->>Monitor: Feed with Progress, Telemetry, and MASKED Scores (hidden)
        else Exam Concluded or All Submitted
            EvalMod-->>Monitor: Feed with UNMASKED Scores + Full Post-Exam Leaderboard
        end
    end

    alt Admin Inspects Candidate Answer Sheet
        Admin->>Monitor: Click "Inspect Sheet" on candidate row
        Monitor->>EvalMod: GET /api/exams/:id/candidates/:userId/sheet
        EvalMod->>DB: Fetch Questions, Candidate Answers, Expected Answers, Code Snapshots
        EvalMod-->>Monitor: Complete Answer Sheet with Evaluation Breakdown
        Monitor->>Admin: Open High-Contrast Modal showing Side-by-Side Answers & Monaco Code
    end
```

---

## 8. Complete API Endpoint Reference Catalog

All 28 backend endpoints are mounted under the `/api` prefix.

### 8.1 Health & CSRF

| Method | Endpoint | Required Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | System health check and uptime probe |
| `GET` | `/api/csrf-token` | Public | Issues Double-Submit CSRF cookie and token |

### 8.2 Authentication (`/api/auth`)

| Method | Endpoint | Required Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Registers a new student account |
| `POST` | `/api/auth/login` | Public | Authenticates credentials, verifies 2FA, sets refresh cookie |
| `POST` | `/api/auth/refresh` | Public (Cookie) | Rotates refresh token and issues new JWT access token |
| `POST` | `/api/auth/logout` | Authenticated | Invalidates session in database and clears cookies |
| `POST` | `/api/auth/2fa/setup` | Authenticated | Generates TOTP secret and OTPAuth URI for authenticator app |
| `POST` | `/api/auth/2fa/confirm` | Authenticated | Verifies 6-digit TOTP token to activate 2FA |
| `POST` | `/api/auth/admin/create` | `ADMIN` | Provisions a new Administrator user |

### 8.3 Exam Configuration & Studio (`/api/exams`)

| Method | Endpoint | Required Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/exams` | `ADMIN` | Lists all configured exams with submission & seating counts |
| `GET` | `/api/exams/:examId` | `ADMIN` | Fetches single exam configuration details and question list |
| `POST` | `/api/exams` | `ADMIN` | Creates a new exam with scheduling, duration, and test ID |
| `PUT` | `/api/exams/:examId` | `ADMIN` | Updates exam scheduling and proctoring parameters |
| `DELETE` | `/api/exams/:examId` | `ADMIN` | Deletes an exam and cascades associated data |
| `POST` | `/api/exams/:examId/questions` | `ADMIN` | Saves or overwrites question inventory for the exam |
| `PUT` | `/api/exams/:examId/questions` | `ADMIN` | Replaces question set with updated metadata |
| `POST` | `/api/exams/:examId/seating-plan/csv` | `ADMIN` | Uploads classroom seating CSV and creates desk mappings |
| `POST` | `/api/exams/:examId/accommodations` | `ADMIN` | Grants extra time accommodation to a candidate |

### 8.4 Exam Delivery & Time-Gating (`/api/exams`)

| Method | Endpoint | Required Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/exams/:examId/session-config` | `CANDIDATE` | Enforces time-gating, returns status, desk, and timing |
| `GET` | `/api/exams/:examId/questions` | `CANDIDATE` | Fetches candidate questions (correct solutions stripped) |
| `POST` | `/api/exams/:examId/device-check` | `CANDIDATE` | Logs candidate webcam & audio diagnostic check result |
| `POST` | `/api/exams/:examId/fullscreen-event` | `CANDIDATE` | Records fullscreen entrance or violation exit events |

### 8.5 Integrity Monitoring & Telemetry (`/api/exams`)

| Method | Endpoint | Required Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/exams/:examId/proctoring/frame` | `CANDIDATE` | Ingests video frame analysis and anomaly cheat score |
| `POST` | `/api/exams/:examId/telemetry/editor` | `CANDIDATE` | Persists Monaco editor keystrokes, paste, and blur events |
| `POST` | `/api/exams/:examId/focus-event` | `CANDIDATE` | Records window focus loss, tab switching, and minimization |
| `GET` | `/api/exams/:examId/proctoring/alerts` | `ADMIN` | Fetches flagged proctoring anomalies for invigilation |
| `POST` | `/api/exams/:examId/sessions/:userId/auto-logout` | Authenticated | Triggers forced candidate termination upon severe violation |

### 8.6 Evaluation, Auto-Grading & Analytics (`/api/exams`)

| Method | Endpoint | Required Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/exams/:examId/responses/autosave` | `CANDIDATE` | Periodically saves draft answers and editor telemetry |
| `POST` | `/api/exams/:examId/responses/submit` | `CANDIDATE` | Finalizes exam, executes strict auto-grading, locks submission |
| `GET` | `/api/exams/:examId/monitor-feed` | `ADMIN` | Real-time live feed of candidate progress, desk, and scores |
| `GET` | `/api/exams/:examId/candidates/:userId/sheet` | `ADMIN` | Fetches complete candidate answer sheet with grading details |
| `GET` | `/api/exams/:examId/export` | `ADMIN` | Generates downloadable CSV report of all candidate scores |

---

## 9. Verification & Testing Manual

### 9.1 Automated End-to-End Test Suite (Playwright)

Proctora includes a fully automated end-to-end test script [`frontend/verify_e2e.ts`](file:///home/harshith/dev/Proctora/frontend/verify_e2e.ts) that executes the complete lifecycle using headless Chromium:
1. Logs in as candidate `student@proctora.edu`.
2. Validates minimalist candidate dashboard and enters Test ID `TEST-MS2026`.
3. Navigates to `/exams/TEST-MS2026/portal` and validates time-gating.
4. Answers all 10 questions (MCQ Single, Multi-Correct, types Python solution into Monaco Editor, and fills Descriptive answers).
5. Confirms submission via modal dialog.
6. Logs in as administrator `admin@proctora.edu`.
7. Navigates to `/admin/exams/TEST-MS2026/monitor`.
8. Verifies real candidate seating row/column, submission status, telemetry stats, and post-exam leaderboard sorting.
9. Opens candidate answer sheet modal and validates auto-graded scores and Monaco code snapshots.

**To execute the automated test:**
```bash
# 1. Reset database to fresh Morgan Stanley OA state
cd backend
npm run seed:oa

# 2. Run Playwright verification
cd ../frontend
npx tsx verify_e2e.ts
```

---

### 9.2 Step-by-Step Manual Testing Walkthrough

Follow these steps to manually verify every system feature in a web browser:

#### Candidate Journey:
1. Open `http://localhost:5173/login`.
2. Sign in as Candidate: `student@proctora.edu` / `Student@12345`.
3. You will land on the minimalist **Candidate Examination Portal** (`/dashboard`).
4. Type or paste Test ID: `TEST-MS2026` and click **"Proceed to Examination"**.
5. The portal validates your seating assignment (Row 1, Column 1, `SET-A`).
6. Answer Question 1 through 6 (MCQs).
7. On Question 7, interact with the **Monaco Code Editor**. Notice the live telemetry bar updates keystroke count (`X keys • 0 pastes • 0 blur events`).
8. Navigate through questions and click **"Submit Exam"** in the top right corner.
9. Confirm in the dialog. You will be redirected to the secure submission confirmation screen (`/submitted`).

#### Administrator / Invigilator Journey:
1. In an Incognito window or after signing out, open `http://localhost:5173/login`.
2. Sign in as Admin: `admin@proctora.edu` / `Admin@12345`.
3. The Admin Dashboard displays all configured tests with real question counts and submissions.
4. Click **"Live Invigilation Feed"** on the Morgan Stanley OA card (or navigate to `/admin/exams/TEST-MS2026/monitor`).
5. Observe the live candidate table showing `Jane Doe (21CS001)`, Seat `Row 1, Col 1`, Status `Submitted`, Progress `10 / 10`, Coding Telemetry, and Score `9 / 25`.
6. Scroll down to the **Post-Exam Leaderboard & Analytics** section. Test the sort dropdown (*Score: Highest First*, *Fastest Completion*, etc.).
7. Click **"Inspect Sheet"** or **"View Graded Sheet"**.
8. Inspect the side-by-side evaluation modal showing exact candidate responses, correct keys, point pills, and the Monaco Python code snapshot.
9. Click **"Export CSV"** in the top navigation bar to download the institutional grade ledger.

---

## 10. Troubleshooting & Common FAQ

### Q1: `Error: connect ECONNREFUSED 127.0.0.1:5432`
- **Cause**: PostgreSQL is not running or the port is blocked.
- **Solution**: Start PostgreSQL service (`sudo service postgresql start` or verify your Docker container is up: `docker ps`). Ensure `DATABASE_URL` in `backend/.env` matches your local database credentials.

### Q2: `CORS policy: No 'Access-Control-Allow-Origin' header is present`
- **Cause**: The frontend origin does not match `CLIENT_URL` in `backend/.env`.
- **Solution**: Ensure `CLIENT_URL=http://localhost:5173` is set in `backend/.env`. In production, set this to your registered domain name.

### Q3: `403 Forbidden: Invalid CSRF Token`
- **Cause**: The browser rejected session cookies or requests were made without `credentials: "include"`.
- **Solution**: Ensure your browser accepts cookies for `localhost`. In frontend API calls, always use the unified API client [`frontend/src/lib/api.ts`](file:///home/harshith/dev/Proctora/frontend/src/lib/api.ts) which automatically manages CSRF token extraction and header injection.

### Q4: Camera and Microphone Permission Denied
- **Cause**: Browser permissions are blocked for `localhost`.
- **Solution**: Click the camera icon in your browser URL bar, select **"Always allow http://localhost:5173 to access your camera and microphone"**, and refresh the page.

### Q5: How do I completely wipe and restart with a clean database?
- **Command**:
  ```bash
  cd backend
  npm run db:reset-except-admin
  npm run seed:oa
  ```
  This returns the system to a clean state with `admin@proctora.edu` preserved and a fresh `TEST-MS2026` test ready.

---

## 11. Production Deployment Checklist

When deploying Proctora to a public cloud environment (AWS, GCP, DigitalOcean, or Azure):

1. **Security Secrets**:
   - Change `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`, and `AES_ENCRYPTION_KEY` to cryptographically random 64-character hex strings generated via `openssl rand -hex 32`.
2. **HTTPS / TLS Termination**:
   - Serve both API and frontend over valid HTTPS certificates (Let's Encrypt / Cloudflare). WebRTC camera streaming **requires HTTPS** when accessed over non-localhost domains.
3. **Cookie Security**:
   - Set `secure: true` on JWT and CSRF cookies in [`auth.middleware.ts`](file:///home/harshith/dev/Proctora/backend/src/middleware/auth.middleware.ts) and [`csrf.middleware.ts`](file:///home/harshith/dev/Proctora/backend/src/middleware/csrf.middleware.ts).
4. **Database Connection Pooling**:
   - Use PgBouncer or managed PostgreSQL connection pooling (e.g. Supabase, AWS RDS Proxy) for concurrent candidate loads exceeding 500 examinees.
5. **Reverse Proxy Configuration**:
   - Configure NGINX or Caddy to forward WebSocket upgrade headers (`Upgrade: $http_upgrade`, `Connection: "upgrade"`) for the `/ws` route.
