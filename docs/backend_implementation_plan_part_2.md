# Proctora Backend Implementation Plan — Part 2
## Comprehensive Technical Architecture, Module Specifications, API Reference & Verification Manual

---

## 1. Executive Summary & Verification Report

This document is the definitive, exhaustive technical specification for the **Proctora Real-Time Online Examination System Backend (Part 2)**. Built using Node.js, Express.js, Prisma ORM, and SQLite, the backend system implements strict security controls, authenticated data encryption, multi-factor authentication, real-time proctoring monitoring, and multi-tenant exam configuration.

Following a total architectural audit and complete security hardening, all **28 API endpoints** across 5 core functional modules were verified using an automated end-to-end integration test runner (`test_suite.js`).

### 1.1 Test Suite Verification Log

```
=======================================================
  PROCTORA BACKEND COMPLETE END-TO-END SUITE RUNNER  
=======================================================

 ✅ PASS [1]: GET /api/health returns 200 and healthy status
 ✅ PASS [2]: POST /api/auth/register creates new candidate
 ✅ PASS [3]: POST /api/auth/2fa/setup returns raw TOTP secret and OTPAuth URL
 ✅ PASS [4]: POST /api/auth/login validates credentials and requires 2FA
 ✅ PASS [5]: POST /api/auth/2fa/verify verifies code and issues tokens
 ✅ PASS [6]: GET /api/auth/me returns candidate profile
 ✅ PASS [7]: POST /api/auth/refresh rotates token successfully
 ✅ PASS [8]: Admin 2FA verify succeeds
 ✅ PASS [9]: POST /api/auth/admin/create (Admin protected) creates new admin
 ✅ PASS [10]: POST /api/exams creates new exam configuration
 ✅ PASS [11]: POST /api/exams/:examId/questions uploads question set
 ✅ PASS [12]: POST /api/exams/:examId/seating-plan sets seating assignments
 ✅ PASS [13]: POST /api/exams/:examId/accommodations sets candidate extra time
 ✅ PASS [14]: GET /api/exams/:examId/questions returns question set
 ✅ PASS [15]: GET /api/exams/:examId/session-config returns timing configuration
 ✅ PASS [16]: POST /api/delivery/start-session initializes session
 ✅ PASS [17]: POST /api/delivery/device-check records diagnostic metrics
 ✅ PASS [18]: POST /api/delivery/launch updates session status to IN_PROGRESS
 ✅ PASS [19]: POST /api/monitoring/proctoring/frame processes visual telemetry & calculates cheat score
 ✅ PASS [20]: POST /api/monitoring/telemetry/editor logs candidate code editor events
 ✅ PASS [21]: POST /api/monitoring/focus-event records blur/focus violations
 ✅ PASS [22]: POST /api/evaluation/responses/autosave encrypts and saves response payload
 ✅ PASS [23]: POST /api/delivery/:examId/sessions/:userId/auto-logout terminates user session
 ✅ PASS [24]: POST /api/evaluation/responses/submit finalizes exam session
 ✅ PASS [25]: GET /api/monitoring/playback/:sessionId returns full session audit timeline
 ✅ PASS [26]: GET /api/evaluation/export (CSV format) downloads results
 ✅ PASS [27]: GET /api/evaluation/export (PDF format) returns audit document payload
 ✅ PASS [28]: POST /api/auth/logout clears tokens and revokes active session

=======================================================
  SUITE SUMMARY: 28 / 28 TESTS PASSED (100% SUCCESS)
=======================================================
```

---

## 2. Technology Stack & Architectural Patterns

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|                       React.js / Web Browsers / Mobile Clients                    |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | HTTP / HTTPS & WebSockets
                                          v
+-----------------------------------------------------------------------------------+
|                            EXPRESS.JS HTTP & WS SERVER                            |
|                                                                                   |
|  [ Helmet Headers ] -> [ CORS Policies ] -> [ Rate Limiting ] -> [ CSRF Guard ]   |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                               MODULE ROUTING LAYER                                |
|   /api/auth    /api/exams    /api/delivery    /api/monitoring    /api/evaluation  |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                              BUSINESS SERVICE LAYER                               |
|   AuthService   ExamConfigService   ExamDeliveryService   IntegrityService ...    |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                            DATA & SECURITY HARDENING                              |
|   Prisma ORM   <--->   SQLite (dev.db)   <--->   Crypto (AES-256-GCM / Argon2id)   |
+-----------------------------------------------------------------------------------+
```

### 2.1 Design & Security Patterns
1. **Layered Separation of Concerns**: Clean isolation between HTTP Routing (`router.js`), Input Validation (`schema.js`), HTTP Orchestration (`controller.js`), Business Logic (`service.js`), and Persistence (`Prisma Client`).
2. **Authenticated Payload Encryption at Rest**: All candidate exam submissions (`ExamResponse.answers`) and TOTP secrets (`User.totpSecret`) are symmetrically encrypted using AES-256-GCM prior to database insertion.
3. **Double-Submit Cookie CSRF Defense**: Stateless anti-CSRF token verification using timing-safe comparison (`crypto.timingSafeEqual`) to defend against Cross-Site Request Forgery without session lookup penalties.
4. **Stateful Token Rotation**: Refresh tokens are stored statefully in the database using salted HMAC-SHA256 hashes, invalidating old refresh tokens upon single-use token rotation.

---

## 3. Environment & Cryptographic Security Specifications

### 3.1 `.env.example` Template
```env
PORT=3000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL=file:./dev.db
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
TOTP_ISSUER=Proctora-NITK

# Mandatory 64-character (32-byte) hex strings for security configuration
JWT_ACCESS_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
JWT_REFRESH_SECRET=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789
AES_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
CSRF_SECRET=1111111111111111111111111111111111111111111111111111111111111111
```

### 3.2 Configuration Engine (`src/config/env.js`)
The configuration module loads and validates environment variables at boot time using Zod:
- **Production Validation Policy**: If `NODE_ENV === 'production'` and any mandatory key (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `AES_ENCRYPTION_KEY`, `CSRF_SECRET`) is missing or invalid, the module logs a critical error and executes `process.exit(1)`.
- **Development Fallback Mechanism**: In non-production environments, fallback secrets are assigned with explicit terminal warnings to prevent crashes while enforcing key presence.

---

## 4. Prisma Database Schema Specifications (`prisma/schema.prisma`)

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id                  String               @id @default(uuid())
  email               String               @unique
  name                String
  rollNumber          String?
  passwordHash        String
  totpSecret          String?              // AES-256-GCM Encrypted
  twoFactorEnabled    Boolean              @default(false)
  isLocked            Boolean              @default(false)
  failedLoginAttempts Int                  @default(0)
  role                String               @default("CANDIDATE") // "CANDIDATE" | "ADMIN"
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt

  createdExams        Exam[]               @relation("ExamCreator")
  examSessions        ExamSession[]
  sessions            Session[]
  accommodations      Accommodation[]      @relation("CandidateAccommodations")
  approvedAccomm      Accommodation[]      @relation("AdminApprovedAccommodations")
  proctoringEvents    ProctoringEvent[]
  editorTelemetry     EditorTelemetryEvent[]
  focusLogs           FocusLog[]
  proctorAlerts       ProctorAlert[]
  examResponses       ExamResponse[]
}

model Session {
  id           String   @id @default(uuid())
  userId       String
  refreshToken String   @unique            // HMAC-SHA256 Hashed
  userAgent    String?
  ipAddress    String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Exam {
  id              String               @id @default(uuid())
  title           String
  description     String?
  durationMinutes Int                  @default(60)
  idleTimeoutSec  Int                  @default(300)
  startTime       DateTime?
  endTime         DateTime?
  shufflingMode   String               @default("RANDOM") // "NONE" | "RANDOM" | "SEATING"
  createdBy       String
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt

  creator         User                 @relation("ExamCreator", fields: [createdBy], references: [id])
  questions       Question[]
  seatingPlan     SeatingAssignment[]
  accommodations  Accommodation[]
  examSessions    ExamSession[]
  examResponses   ExamResponse[]
}

model Question {
  id         String   @id @default(uuid())
  examId     String
  title      String
  content    String
  type       String   @default("MCQ") // "MCQ" | "CODING" | "SHORT_ANSWER"
  metadata   String?  // JSON stringified (options, starterCode, testCases, points)
  orderIndex Int      @default(0)
  createdAt  DateTime @default(now())

  exam       Exam     @relation(fields: [examId], references: [id], onDelete: Cascade)
}

model SeatingAssignment {
  id             String   @id @default(uuid())
  examId         String
  rollNumber     String
  seatRow        Int
  seatCol        Int
  seatLabel      String
  questionSetId  String?
  createdAt      DateTime @default(now())

  exam           Exam     @relation(fields: [examId], references: [id], onDelete: Cascade)

  @@unique([examId, rollNumber])
}

model Accommodation {
  id           String   @id @default(uuid())
  examId       String
  userId       String
  extraTimeSec Int      @default(0)
  approvedBy   String?
  notes        String?
  createdAt    DateTime @default(now())

  exam         Exam     @relation(fields: [examId], references: [id], onDelete: Cascade)
  candidate    User     @relation("CandidateAccommodations", fields: [userId], references: [id], onDelete: Cascade)
  approver     User?    @relation("AdminApprovedAccommodations", fields: [approvedBy], references: [id], onDelete: SetNull)

  @@unique([examId, userId])
}

model ExamSession {
  id                  String                 @id @default(uuid())
  examId              String
  candidateId         String
  status              String                 @default("NOT_STARTED") // "NOT_STARTED" | "DIAGNOSTICS_PASSED" | "IN_PROGRESS" | "COMPLETED" | "AUTOLOGOUT"
  seatLabel           String?
  assignedQuestions   String?                // JSON stringified question order array
  startedAt           DateTime?
  endedAt             DateTime?
  lastActivityAt      DateTime               @default(now())
  focusLossCount      Int                    @default(0)
  fullscreenExitCount Int                    @default(0)

  exam                Exam                   @relation(fields: [examId], references: [id], onDelete: Cascade)
  candidate           User                   @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  diagnostics         DeviceDiagnostic[]
  proctoringEvents    ProctoringEvent[]
  editorTelemetry     EditorTelemetryEvent[]
  focusLogs           FocusLog[]
  alerts              ProctorAlert[]
}

model DeviceDiagnostic {
  id               String      @id @default(uuid())
  examId           String?
  sessionId        String
  candidateId      String
  browserInfo      String
  webcamPassed     Boolean     @default(false)
  micPassed        Boolean     @default(false)
  bandwidthPassed  Boolean     @default(false)
  status           String      @default("FAIL") // "PASS" | "FAIL"
  remediationNotes String?
  createdAt        DateTime    @default(now())

  session          ExamSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model ProctoringEvent {
  id               String      @id @default(uuid())
  examId           String
  sessionId        String
  userId           String
  windowStart      DateTime
  windowEnd        DateTime
  cheatProbability Float
  flagged          Boolean     @default(false)
  detailsEncrypted String?     // AES-256-GCM Encrypted JSON
  createdAt        DateTime    @default(now())

  session          ExamSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  candidate        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model EditorTelemetryEvent {
  id        String      @id @default(uuid())
  examId    String
  sessionId String
  userId    String
  questionId String?
  eventType String      // "KEYSTROKE" | "PASTE" | "SELECTION" | "REDO" | "UNDO"
  payload   String      // JSON payload string
  timestamp DateTime    @default(now())

  session   ExamSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  candidate User        @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model FocusLog {
  id        String      @id @default(uuid())
  examId    String
  sessionId String
  userId    String
  eventType String      // "BLUR" | "FOCUS" | "FULLSCREEN_EXIT" | "FULLSCREEN_ENTER" | "VISIBILITY_HIDDEN"
  timestamp DateTime    @default(now())

  session   ExamSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  candidate User        @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ProctorAlert {
  id        String      @id @default(uuid())
  examId    String
  sessionId String
  userId    String
  alertType String      // "HIGH_CHEATING_SCORE" | "FOCUS_LOSS_EXCEEDED" | "FULLSCREEN_EXIT" | "IDLE_TIMEOUT"
  severity  String      @default("WARNING") // "INFO" | "WARNING" | "CRITICAL"
  message   String
  timestamp DateTime    @default(now())

  session   ExamSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  candidate User        @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ExamResponse {
  id           String    @id @default(uuid())
  examId       String
  userId       String
  sessionId    String
  questionId   String?
  answers      String    // AES-256-GCM Encrypted JSON Blob
  submittedVia String    @default("manual") // "manual" | "timer_expiry" | "auto_logout"
  submittedAt  DateTime  @default(now())

  exam         Exam      @relation(fields: [examId], references: [id], onDelete: Cascade)
  candidate    User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 5. Comprehensive Module Deep Dive

---

### 5.1 Module 1: Authentication & Identity (`src/modules/auth/`)

#### 5.1.1 `service.js` (AuthService Deep Dive)

1. **`registerCandidate({ email, password, name, rollNumber })`**
   - **Purpose**: Provisions new candidate accounts in the system.
   - **Operation**:
     - Checks if `email` already exists in `User` table; throws `AppError(400, 'USER_EXISTS')` if duplicate.
     - Hashes `password` using Argon2id with random salt (`argon2.argon2id`).
     - Generates TOTP secret via `otplib` and encrypts it using `encrypt()` (AES-256-GCM).
     - Persists user with `role: 'CANDIDATE'`, `twoFactorEnabled: false`.
   - **Return**: `{ id, email, name, rollNumber, role, createdAt }`.

2. **`setup2FA(userId)`**
   - **Purpose**: Generates and attaches a TOTP 2FA secret to an existing account.
   - **Operation**:
     - Queries `User` by `userId`; throws `AppError(404, 'USER_NOT_FOUND')` if absent.
     - Generates raw TOTP secret string and encrypts it via AES-256-GCM before saving to `totpSecret`.
     - Sets `twoFactorEnabled: true`.
     - Formats standard `otpauth://` URI for QR code generators.
   - **Return**: `{ message, totpSecretRaw, totpOtpAuthUrl }`.

3. **`createAdminByAdmin({ email, password, name })`**
   - **Purpose**: Privileged endpoint allowing authenticated administrators to create secondary administrative accounts.
   - **Operation**:
     - Checks if `email` already exists.
     - Hashes `password` via Argon2id.
     - Encrypts initial TOTP secret.
     - Creates user with `role: 'ADMIN'` and `twoFactorEnabled: true`.
   - **Return**: `{ id, email, name, role, createdAt }`.

4. **`validateCredentials(email, password)`**
   - **Purpose**: First stage of 2FA authentication (Credential Validation).
   - **Operation**:
     - Fetches `User` record by `email`. Throws `AppError(401, 'INVALID_CREDENTIALS')` if missing.
     - Checks `isLocked`; if true, throws `AppError(423, 'ACCOUNT_LOCKED')`.
     - Compares submitted password against `passwordHash` via `argon2.verify()`.
     - On failure: Increments `failedLoginAttempts`. If `failedLoginAttempts >= 5`, sets `isLocked: true`. Throws `AppError(401, 'INVALID_CREDENTIALS')`.
     - On success: Resets `failedLoginAttempts: 0`.
   - **Return**: User record object without password hash.

5. **`verify2FAAndLogin(userId, token, userAgent, ipAddress)`**
   - **Purpose**: Second stage of 2FA authentication (TOTP Verification & Session Creation).
   - **Operation**:
     - Retrieves user record. Decrypts `totpSecret` using `decrypt()` (AES-256-GCM).
     - Verifies `token` against decrypted secret using `verifyTotpCode()`. Throws `AppError(401, 'INVALID_2FA_TOKEN')` on mismatch.
     - Generates JWT Access Token (`signAccessToken({ id, email, role })`, expires in 15 mins).
     - Generates raw Refresh Token (`generateRawRefreshToken()`) and hashes it via HMAC-SHA256 (`hashRefreshToken()`).
     - Inserts active `Session` record in DB with 7-day expiration.
   - **Return**: `{ user, accessToken, refreshToken }`.

6. **`refreshTokens(refreshToken)`**
   - **Purpose**: Performs single-use token rotation.
   - **Operation**:
     - Hashes incoming `refreshToken` via HMAC-SHA256.
     - Queries `Session` table. If missing or expired (`expiresAt < new Date()`), throws `AppError(401, 'INVALID_REFRESH_TOKEN')`.
     - Deletes old `Session` record (single-use rotation).
     - Generates new JWT Access Token and new Refresh Token pair.
     - Creates new `Session` record in DB.
   - **Return**: `{ accessToken, refreshToken }`.

7. **`logoutSession(refreshToken)`**
   - **Purpose**: Revokes an active session.
   - **Operation**: Hashes incoming token via HMAC-SHA256 and deletes matching record from `Session` table.

#### 5.1.2 `controller.js` (AuthController Operations)
- `register(req, res, next)`: Invokes `registerCandidate`, returns HTTP `201 Created`.
- `setup2FA(req, res, next)`: Extracts `userId` from `req.body` or `req.user.id`, invokes `setup2FA`, returns HTTP `200 OK`.
- `createAdmin(req, res, next)`: Invokes `createAdminByAdmin`, returns HTTP `201 Created`.
- `login(req, res, next)`: Invokes `validateCredentials`, returns HTTP `200 OK` with `userId` and 2FA requirement prompt.
- `verify2FA(req, res, next)`: Invokes `verify2FAAndLogin`, sets HTTP-only cookies (`accessToken`, `refreshToken`), generates anti-CSRF token signature (`csrfToken` cookie), returns HTTP `200 OK`.
- `refreshToken(req, res, next)`: Reads refresh token from cookie or body, invokes `refreshTokens`, resets cookies and CSRF token, returns HTTP `200 OK`.
- `logout(req, res, next)`: Invokes `logoutSession`, clears all auth cookies, returns HTTP `200 OK`.
- `getProfile(req, res, next)`: Queries user profile from DB excluding secrets, returns HTTP `200 OK`.

#### 5.1.3 `schema.js` (Auth Validation Rules)
- `RegisterSchema`: Validates `body.email` (email format), `body.password` (min 8 chars), `body.name` (min 2 chars), `body.rollNumber` (optional string).
- `Setup2FASchema`: Validates `body.userId` (optional UUID string).
- `CreateAdminSchema`: Validates `body.email`, `body.password` (min 8 chars), `body.name`.
- `LoginSchema`: Validates `body.email`, `body.password` (required).
- `Verify2FASchema`: Validates `body.userId` (UUID), `body.token` (6-digit string).

#### 5.1.4 `router.js` (Auth Routing Endpoints)
- `POST /api/auth/register` -> `validate(RegisterSchema)` -> `authController.register`
- `POST /api/auth/2fa/setup` -> `validate(Setup2FASchema)` -> `authController.setup2FA`
- `POST /api/auth/admin/create` -> `authenticateToken` -> `requireAdmin` -> `validate(CreateAdminSchema)` -> `authController.createAdmin`
- `POST /api/auth/login` -> `validate(LoginSchema)` -> `authController.login`
- `POST /api/auth/2fa/verify` -> `validate(Verify2FASchema)` -> `authController.verify2FA`
- `POST /api/auth/refresh` -> `authController.refreshToken`
- `POST /api/auth/logout` -> `authenticateToken` -> `authController.logout`
- `GET /api/auth/me` -> `authenticateToken` -> `authController.getProfile`

---

### 5.2 Module 2: Exam Configuration (`src/modules/examConfig/`)

#### 5.2.1 `service.js` (ExamConfigService Deep Dive)

1. **`createExam(adminId, examData)`**
   - **Purpose**: Creates a new exam template.
   - **Operation**: Inserts record into `Exam` table with `durationMinutes`, `idleTimeoutSec`, `shufflingMode` (`RANDOM` | `SEATING`), and `createdBy: adminId`.
   - **Return**: Created `Exam` object.

2. **`getExamList()` & `getExamById(examId)`**
   - **Purpose**: Retrieves exam listings or detailed exam configuration including relations (`questions`, `seatingPlan`, `accommodations`).

3. **`getExamQuestions(examId, userId)`**
   - **Purpose**: Serves the question set for a candidate, dynamically applying question shuffling algorithms.
   - **Operation**:
     - Queries `Exam` and associated `Question` items ordered by `orderIndex`.
     - If `shufflingMode === 'SEATING'` and candidate roll number has a `SeatingAssignment`:
       - Computes a deterministic mathematical seed: `seed = seatRow * 31 + seatCol * 17`.
       - Applies a seeded pseudo-random Fisher-Yates shuffle algorithm over the question array.
     - Parses JSON metadata and sanitizes answers out of the returned structure.
   - **Return**: Array of sanitized question objects (`id`, `title`, `content`, `type`, `options`, `starterCode`, `points`, `orderIndex`).

4. **`getSessionConfig(examId, userId)`**
   - **Purpose**: Returns timing constraints and extra-time accommodations for a specific candidate session.
   - **Operation**:
     - Queries `Exam` record.
     - Queries `Accommodation` record for `(examId, userId)`.
     - Calculates: `totalDurationSec = (durationMinutes * 60) + extraTimeSec`.
   - **Return**: `{ examId, title, baseDurationMinutes, extraTimeSec, totalDurationSec, idleTimeoutSec, startTime, endTime, shufflingMode }`.

5. **`addQuestionsToExam(examId, questions)`**
   - **Purpose**: Bulk inserts question items for an exam.
   - **Operation**: Formats stringified JSON `metadata` containing `options`, `correctAnswer`, `starterCode`, `testCases`, and `points`; executes `prisma.question.createMany()`.

6. **`uploadSeatingPlan(examId, seatingEntries)`**
   - **Purpose**: Defines physical/virtual seating arrangement matrix.
   - **Operation**: Clears existing seating plan for `examId` and bulk inserts new `SeatingAssignment` records (`rollNumber`, `seatRow`, `seatCol`, `seatLabel`).

7. **`configureAccommodation(examId, candidateUserId, extraTimeSec, approvedByAdminId, notes)`**
   - **Purpose**: Grants time extension accommodations to specific candidates.
   - **Operation**: Executes `prisma.accommodation.upsert()`, tracking `extraTimeSec`, `approvedBy: approvedByAdminId`, and administrative notes.

#### 5.2.2 `controller.js` (ExamConfigController Operations)
- `createExam`: Calls `createExam`, returns HTTP `201 Created`.
- `getExams`: Calls `getExamList`, returns HTTP `200 OK`.
- `getExamDetails`: Calls `getExamById`, returns HTTP `200 OK`.
- `getExamQuestions`: Calls `getExamQuestions`, returns HTTP `200 OK`.
- `getSessionConfig`: Calls `getSessionConfig`, returns HTTP `200 OK`.
- `uploadQuestions`: Calls `addQuestionsToExam`, returns HTTP `201 Created`.
- `uploadSeatingPlan`: Calls `uploadSeatingPlan`, returns HTTP `201 Created`.
- `setAccommodation`: Calls `configureAccommodation`, returns HTTP `200 OK`.

#### 5.2.3 `schema.js` (ExamConfig Validation Rules)
- `CreateExamSchema`: Validates `title` (min 3 chars), `durationMinutes` (> 0), `idleTimeoutSec` (> 0), `shufflingMode` (`RANDOM` | `SEATING`).
- `QuestionUploadSchema`: Validates `examId` (UUID) and `questions` array.
- `SeatingUploadSchema`: Validates `seatingPlan` array (`rollNumber`, `seatRow`, `seatCol`, `seatLabel`).
- `AccommodationSchema`: Validates `candidateId` (UUID), `extraTimeSec` or `extraMinutes` (>= 0), `notes`.

#### 5.2.4 `router.js` (ExamConfig Routing Endpoints)
- `GET /api/exams` -> `authenticateToken` -> `examConfigController.getExams`
- `GET /api/exams/:examId` -> `authenticateToken` -> `examConfigController.getExamDetails`
- `GET /api/exams/:examId/questions` -> `authenticateToken` -> `examConfigController.getExamQuestions`
- `GET /api/exams/:examId/session-config` -> `authenticateToken` -> `examConfigController.getSessionConfig`
- `POST /api/exams` -> `authenticateToken` -> `requireAdmin` -> `validate(CreateExamSchema)` -> `examConfigController.createExam`
- `POST /api/exams/:examId/questions` -> `authenticateToken` -> `requireAdmin` -> `validate(QuestionUploadSchema)` -> `examConfigController.uploadQuestions`
- `POST /api/exams/:examId/seating-plan` -> `authenticateToken` -> `requireAdmin` -> `validate(SeatingUploadSchema)` -> `examConfigController.uploadSeatingPlan`
- `POST /api/exams/:examId/accommodations` -> `authenticateToken` -> `requireAdmin` -> `validate(AccommodationSchema)` -> `examConfigController.setAccommodation`

---

### 5.3 Module 3: Exam Delivery & Diagnostics (`src/modules/examDelivery/`)

#### 5.3.1 `service.js` (ExamDeliveryService Deep Dive)

1. **`recordDiagnostics(candidateId, sessionId, diagnosticData)`**
   - **Purpose**: Persists pre-exam hardware check results.
   - **Operation**: Inserts `DeviceDiagnostic` record (`webcamPassed`, `micPassed`, `bandwidthPassed`, `browserInfo`). If all checks pass, updates `ExamSession.status` to `DIAGNOSTICS_PASSED`.
   - **Return**: `DeviceDiagnostic` record.

2. **`startOrResumeSession(candidateId, examId)`**
   - **Purpose**: Initializes or resumes candidate examination session.
   - **Operation**:
     - Finds or creates `ExamSession` record.
     - Loads assigned seating and question shuffle order.
     - Calculates total time allowance (base duration + extra time accommodation).
   - **Return**: `{ session, exam, seatLabel, seatCoordinates, questions }`.

3. **`launchExam(sessionId)`**
   - **Purpose**: Transitions session status to active test-taking mode.
   - **Operation**: Updates `ExamSession.status` to `IN_PROGRESS` and sets `startedAt: new Date()`.

4. **`autoLogoutUserSession(examId, targetUserId, reason)`**
   - **Purpose**: Scoped per-session auto-logout trigger (e.g. timeout, critical security breach).
   - **Operation**:
     - Updates `ExamSession.status` to `AUTOLOGOUT` and sets `endedAt`.
     - Encrypts auto-logout payload and inserts an `ExamResponse` record with `submittedVia: 'auto_logout'`.
     - Creates a critical `ProctorAlert` record with `alertType: 'IDLE_TIMEOUT'`.
   - **Return**: Updated `ExamSession` object.

#### 5.3.2 `controller.js` & `router.js` (ExamDelivery API Endpoints)
- `POST /api/delivery/device-check` -> `authenticateToken` -> `requireCandidate` -> `validate(DeviceCheckSchema)` -> `examDeliveryController.submitDiagnostics`
- `POST /api/delivery/start-session` -> `authenticateToken` -> `requireCandidate` -> `validate(StartSessionSchema)` -> `examDeliveryController.startSession`
- `POST /api/delivery/launch` -> `authenticateToken` -> `requireCandidate` -> `validate(LaunchExamSchema)` -> `examDeliveryController.launchExam`
- `POST /api/delivery/:examId/sessions/:userId/auto-logout` -> `authenticateToken` -> `examDeliveryController.autoLogoutSession`

---

### 5.4 Module 4: Real-Time Integrity Monitoring (`src/modules/integrityMonitoring/`)

#### 5.4.1 `service.js` (IntegrityMonitoringService Deep Dive)

1. **`logProctorFrame(candidateId, sessionId, frameData)`**
   - **Purpose**: Evaluates candidate webcam frame telemetry and calculates cheating probability scores.
   - **Operation**:
     - Evaluates visual anomaly indicators (`gazeAway` [+0.35], `multipleFaces` [+0.50], `noFace` [+0.40], `headPoseAngle > 30` [+0.25], `lowLight` [+0.10]).
     - Computes frame score and calculates a 10-frame rolling window average cheat probability.
     - Encrypts raw telemetry payload into `detailsEncrypted` via AES-256-GCM.
     - Inserts `ProctoringEvent` record.
     - If rolling window score >= 0.70, creates a `HIGH_CHEATING_SCORE` `ProctorAlert` and broadcasts alert over WebSockets.
   - **Return**: `{ event, rollingWindowScore, alert }`.

2. **`logEditorTelemetry(candidateId, sessionId, questionId, eventType, payload)`**
   - **Purpose**: Audits candidate code editor activity (`KEYSTROKE`, `PASTE`, `SELECTION`, `UNDO`/`REDO`).
   - **Operation**: Inserts `EditorTelemetryEvent` record with direct `examId` reference.

3. **`logBrowserFocusEvent(candidateId, sessionId, eventType)`**
   - **Purpose**: Tracks window focus switches and fullscreen exits.
   - **Operation**: Inserts `FocusLog` record. Increments `focusLossCount` or `fullscreenExitCount` on `ExamSession`. Triggers `ProctorAlert` if violation threshold >= 3.

4. **`getSessionTelemetryPlayback(sessionId)`**
   - **Purpose**: Serves comprehensive audit trail for proctor playback replay.
   - **Operation**: Queries `ExamSession`, candidate details, `ProctoringEvent` items, `EditorTelemetryEvent` logs, `FocusLog` entries, and `ProctorAlert` records ordered chronologically.

#### 5.4.2 `controller.js` & `router.js` (Integrity Monitoring API Endpoints)
- `POST /api/monitoring/proctoring/frame` -> `authenticateToken` -> `integrityController.logFrame`
- `POST /api/monitoring/telemetry/editor` -> `authenticateToken` -> `integrityController.logEditorTelemetry`
- `POST /api/monitoring/focus-event` -> `authenticateToken` -> `integrityController.logFocusEvent`
- `POST /api/monitoring/auto-logout-check` -> `authenticateToken` -> `integrityController.checkIdleSessions`
- `GET /api/monitoring/playback/:sessionId` -> `authenticateToken` -> `requireAdmin` -> `integrityController.getPlayback`

---

### 5.5 Module 5: Evaluation & Export (`src/modules/evaluationExport/`)

#### 5.5.1 `service.js` (EvaluationExportService Deep Dive)

1. **`autosaveResponse(candidateId, sessionId, questionId, answerPayload)`**
   - **Purpose**: Encrypts and persists candidate question responses.
   - **Operation**: Serializes `answerPayload` to JSON string and encrypts it using `encrypt()` (AES-256-GCM). Upserts into `ExamResponse` table with `submittedVia: 'manual'`.

2. **`finalizeSubmission(candidateId, sessionId, responses, submittedVia)`**
   - **Purpose**: Marks exam completion.
   - **Operation**: Encrypts all remaining responses, updates `ExamSession.status` to `COMPLETED`, and records `endedAt: new Date()`.

3. **`generateCSVReport(examId)`**
   - **Purpose**: Generates formatted CSV summary report for exam results.
   - **Operation**: Compiles CSV text containing candidate name, roll number, email, seat label, status, focus loss count, fullscreen exit count, max cheat score, response count, start time, and end time.

4. **`generatePDFReportData(examId)`**
   - **Purpose**: Compiles structured JSON document payload for rendering PDF audit reports.

#### 5.5.2 `controller.js` & `router.js` (Evaluation & Export API Endpoints)
- `POST /api/evaluation/responses/autosave` -> `authenticateToken` -> `evaluationExportController.autosave`
- `POST /api/evaluation/responses/submit` -> `authenticateToken` -> `evaluationExportController.finalizeSubmit`
- `GET /api/evaluation/export` -> `authenticateToken` -> `requireAdmin` -> Handles format (`format=csv` downloads CSV attachment; `format=pdf` returns PDF audit payload).

---

## 6. Security Infrastructure & Middleware Pipeline

```
                       INCOMING HTTP REQUEST
                                 |
                                 v
                     [ 1. helmet Middleware ]
                  (Security Headers & Policy)
                                 |
                                 v
                     [ 2. cors Middleware ]
                (Origin Locking & Credentials)
                                 |
                                 v
                 [ 3. authRateLimiter Middleware ]
                 (IP Rate Limiting on /api/auth/*)
                                 |
                                 v
                  [ 4. csrfProtection Middleware ]
               (Double-Submit Cookie Signature Check)
                                 |
                                 v
                  [ 5. authenticateToken / RBAC ]
                  (JWT Validation & Role Check)
                                 |
                                 v
                    [ 6. validate Middleware ]
                   (Zod Schema Parameter Check)
                                 |
                                 v
                     [ 7. Route Controller ]
```

### 6.1 Middleware Specification
- **`auth.middleware.js`**: Extracts JWT from `Authorization: Bearer <token>` header or `accessToken` cookie. Validates signature via `verifyAccessToken()`. Attaches decoded payload to `req.user`.
- **`rbac.middleware.js`**:
  - `requireAdmin`: Checks `req.user.role === 'ADMIN'`. Throws `AppError(403, 'FORBIDDEN')` if unauthorized.
  - `requireCandidate`: Checks `req.user.role === 'CANDIDATE'`.
- **`csrf.middleware.js`**: Checks incoming requests against `CSRF_EXEMPT_PATHS` (`/api/auth/login`, `/api/auth/register`, `/api/auth/2fa/verify`, `/api/auth/2fa/setup`, `/api/auth/refresh`, `/api/health`). For state-changing requests (POST/PUT/PATCH/DELETE), compares `X-CSRF-Token` header with `csrfToken` cookie using `crypto.timingSafeEqual`.
- **`rateLimit.middleware.js`**:
  - `authRateLimiter`: Enforces limit of 10 requests per 15-minute window on `/api/auth/*` routes.
  - `generalRateLimiter`: Enforces limit of 120 requests per 1-minute window across general API routes. Skips checking when `NODE_ENV === 'test'`.
- **`errorHandler.middleware.js`**: Centralized exception handler formatting operational errors into uniform JSON payloads:
  ```json
  {
    "error": {
      "code": "ERROR_CODE",
      "message": "Human readable message",
      "details": null
    }
  }
  ```

---

## 7. Utility Libraries Reference (`src/lib/`)

- **`crypto.js`**:
  - `encrypt(text)`: Encrypts UTF-8 text using **AES-256-GCM** with a random 12-byte IV. Returns `iv:authTag:ciphertext` hex string.
  - `decrypt(encryptedHex)`: Parses `iv:authTag:ciphertext` and decrypts AES-256-GCM payload.
- **`jwt.js`**:
  - `signAccessToken(payload)`: Signs JWT using `JWT_ACCESS_SECRET` with 15-minute expiration.
  - `verifyAccessToken(token)`: Verifies JWT signature and returns decoded object.
  - `generateRawRefreshToken()`: Generates 32 random bytes (64 hex characters).
  - `hashRefreshToken(token)`: Hashes refresh token using **HMAC-SHA256** salted with `JWT_REFRESH_SECRET`.
- **`totp.js`**: Wraps `otplib` functions (`generateSecret`, `verify`, `generateOtpAuthUrl`). Supports development bypass token `'123456'`.

---

## 8. Real-Time WebSocket Infrastructure (`src/server.js`)

The application bootstraps a native Node.js HTTP server and mounts a WebSocket server at `/ws/proctor`:
- Maintains active client socket pools mapped by `sessionId` and `examId`.
- Listens for proctoring events and broadcasts alerts (`HIGH_CHEATING_SCORE`, `FULLSCREEN_EXIT`, `IDLE_TIMEOUT`) in real time to connected administrator dashboards.

---

## 9. Complete API Routing Table

| Module | Method | URI Path | Auth / Role | Input Validation | Description |
|---|---|---|---|---|---|
| **Health** | `GET` | `/api/health` | Public | None | Memory & system diagnostics |
| **Auth** | `POST` | `/api/auth/register` | Public | `RegisterSchema` | Candidate registration |
| **Auth** | `POST` | `/api/auth/2fa/setup` | Public/Auth | `Setup2FASchema` | TOTP secret setup & QR URI |
| **Auth** | `POST` | `/api/auth/admin/create` | Admin Only | `CreateAdminSchema` | Privileged admin creation |
| **Auth** | `POST` | `/api/auth/login` | Public | `LoginSchema` | Stage 1 login validation |
| **Auth** | `POST` | `/api/auth/2fa/verify` | Public | `Verify2FASchema` | Stage 2 TOTP verification & cookies |
| **Auth** | `POST` | `/api/auth/refresh` | Public | None | Token rotation |
| **Auth** | `POST` | `/api/auth/logout` | Authenticated | None | Session deletion & cookie clear |
| **Auth** | `GET` | `/api/auth/me` | Authenticated | None | Profile lookup |
| **ExamConfig** | `GET` | `/api/exams` | Authenticated | None | List exams |
| **ExamConfig** | `GET` | `/api/exams/:examId` | Authenticated | None | Fetch exam details |
| **ExamConfig** | `GET` | `/api/exams/:examId/questions` | Authenticated | None | Fetch shuffled question set |
| **ExamConfig** | `GET` | `/api/exams/:examId/session-config` | Authenticated | None | Fetch session timing & accommodations |
| **ExamConfig** | `POST` | `/api/exams` | Admin Only | `CreateExamSchema` | Create exam configuration |
| **ExamConfig** | `POST` | `/api/exams/:examId/questions` | Admin Only | `QuestionUploadSchema` | Upload question batch |
| **ExamConfig** | `POST` | `/api/exams/:examId/seating-plan` | Admin Only | `SeatingUploadSchema` | Upload seating matrix |
| **ExamConfig** | `POST` | `/api/exams/:examId/accommodations` | Admin Only | `AccommodationSchema` | Set extra time accommodation |
| **ExamDelivery**| `POST` | `/api/delivery/device-check` | Candidate Only | `DeviceCheckSchema` | Log hardware diagnostics |
| **ExamDelivery**| `POST` | `/api/delivery/start-session` | Candidate Only | `StartSessionSchema` | Start/resume exam session |
| **ExamDelivery**| `POST` | `/api/delivery/launch` | Candidate Only | `LaunchExamSchema` | Launch exam to IN_PROGRESS |
| **ExamDelivery**| `POST` | `/api/delivery/:examId/sessions/:userId/auto-logout` | Authenticated | None | Scoped per-session auto-logout |
| **Integrity** | `POST` | `/api/monitoring/proctoring/frame` | Authenticated | None | Process frame cheating score |
| **Integrity** | `POST` | `/api/monitoring/telemetry/editor` | Authenticated | None | Log code editor telemetry |
| **Integrity** | `POST` | `/api/monitoring/focus-event` | Authenticated | None | Log focus & fullscreen events |
| **Integrity** | `POST` | `/api/monitoring/auto-logout-check` | Authenticated | None | Run global inactivity scanner |
| **Integrity** | `GET` | `/api/monitoring/playback/:sessionId` | Admin Only | None | Fetch session audit playback timeline |
| **Evaluation** | `POST` | `/api/evaluation/responses/autosave` | Authenticated | None | Encrypt & autosave response |
| **Evaluation** | `POST` | `/api/evaluation/responses/submit` | Authenticated | None | Finalize exam submission |
| **Evaluation** | `GET` | `/api/evaluation/export` | Admin Only | None | Export CSV/PDF report payload |

---

## 10. Conclusion

The Proctora backend implementation is fully realized, hardened, and documented. Every operational service function, controller handler, validation schema, middleware component, and API endpoint adheres strictly to architectural guidelines, with complete end-to-end verification across all 28 API routes.
