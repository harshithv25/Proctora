# Proctora — Architecture & Implementation Guide

## 1. Overview & Summary of Changes

The backend was built from scratch into a modern, type-safe architecture following the SRS, DFD, and Structure Chart specifications:

- **Legacy Removal**: Deleted outdated JavaScript implementations, test scripts, and local SQLite artifacts.
- **Strict TypeScript & Express 5**: Clean modular structure split into config, middleware, libraries, modules, and routes.
- **Relational Data Layer (PostgreSQL + Prisma 7)**: Replaced mock storage with a normalized relational schema mapping all Level-1/Level-2 entities:
  - `User`, `Session`, `Exam`, `Question`, `SeatingAssignment`, `Accommodation`, `ExamResponse`, `ProctoringEvent`, `FocusLog`, `EditorTelemetryEvent`.
- **Security & Cryptography Foundation**:
  - Symmetric AES-256-GCM authenticated encryption for sensitive payloads at rest.
  - Argon2id password hashing.
  - Stateless JWT access tokens (15m) paired with rotating refresh tokens stored in hashed sessions (7d).
  - TOTP-based 2FA (RFC 6238 via `otplib`) with encrypted secrets at rest.
  - Double-submit cookie CSRF protection (`csrf-csrf`).
  - Account lockout tracking after repeated failed login attempts.
  - Rate limiting via `express-rate-limit`.
- **DFD Core Modules**:
  - `auth`: Registration, login, 2FA setup/verification, token refresh, logout, admin seeding.
  - `examConfig`: Exam creation, question bank upload, seating assignment mapping, accommodations.
  - `examDelivery`: Device diagnostics check, randomized/seating question distribution, fullscreen logging, session timer config.
  - `integrityMonitoring`: Proctoring frame ingestion, editor telemetry logging, focus/blur event tracking, alert feeds, auto-logout on idle timeout.
  - `evaluationExport`: In-progress response autosave, exam submission, CSV/PDF candidate reports.
- **Real-Time Layer**: Express HTTP app paired with a native WebSocket (`ws`) server on `/ws` for streaming telemetry and live proctoring alerts.
- **Frontend Integration**: Svelte 5 SPA with reactive runes and minimalistic styling merged into `main`.

---

## 2. Tech Stack & Component Mapping

| Technology | Category | Role in Application |
|---|---|---|
| **TypeScript / Node.js** | Core Platform | Type-safe runtime enforcing compile-time correctness across all layers. |
| **Express 5** | Web Framework | REST routing, middleware chaining, JSON parsing, cookie handling. |
| **PostgreSQL** | Database | Primary relational store for ACID compliance, seating plans, and session integrity. |
| **Prisma 7** | ORM | Schema migrations, type-safe query generation, singleton client in `src/config/db.ts`. |
| **Zod** | Validation | Validates environment variables at startup (`src/config/env.ts`) and incoming HTTP request DTOs (`src/middleware/validate.middleware.ts`). |
| **Argon2id (`argon2`)** | Hashing | One-way hashing of user passwords with memory-hard algorithm resisting GPU cracking. |
| **Node.js `crypto`** | Cryptography | Authenticated AES-256-GCM symmetric encryption for TOTP secrets, gaze details, and exam answers; SHA-256 for session refresh tokens. |
| **`jsonwebtoken`** | Token Auth | Signs and verifies short-lived access JWTs containing `userId` and `role`. |
| **`otplib` (v13)** | Two-Factor Auth | Generates base32 TOTP secrets, formats `otpauth://` URIs, and validates one-time codes with time-window tolerance. |
| **`csrf-csrf`** | CSRF Protection | Implements double-submit cookie pattern with HMAC signing; validates `X-CSRF-Token` against cookies on mutating requests (`POST`/`PUT`/`DELETE`). |
| **`express-rate-limit`** | Rate Limiting | In-memory sliding window rate limiting on public auth endpoints to mitigate brute-force attacks. |
| **`ws`** | Real-Time Transport | WebSocket server mounted on `/ws` for bi-directional streaming of editor telemetry and proctoring alerts. |
| **Svelte 5 + Vite** | Frontend SPA | Reactive web interface using `$state` runes and custom CSS design system. |

---

## 3. AI Proctoring Pipeline (Next Steps)

The API contracts, database schema, and streaming skeleton for proctoring are already established. The remaining AI work consists of:

### A. Computer Vision Inference (Frame Analysis)
- **Pipeline**: Deploy a lightweight CV model (client-side via MediaPipe / TensorFlow.js, or server-side via Python / ONNX).
- **Core Detectors**:
  1. *Face Presence*: Flag `ABSENT` if no human face is detected in the video stream.
  2. *Multi-person Detection*: Flag `MULTIPLE_FACES` if >1 face is detected.
  3. *Gaze Tracking*: Calculate pupil position and eye vector to flag gaze deviation away from the display area.
  4. *Head Pose Estimation*: Compute yaw, pitch, and roll to detect turning toward external materials or second screens.

### B. Aggregation & Scoring
- Aggregate predictions over a sliding window (e.g., 5–10 seconds) between `windowStart` and `windowEnd`.
- Compute a normalized `cheatProbability` score (`0.0` to `1.0`).
- Mark `flagged = true` when `cheatProbability` crosses the institutional threshold.

### C. Ingestion & Encryption Flow
- **Ingestion Endpoints**:
  - High-frequency live stream: WebSocket channel `/ws/exam/:examId`.
  - Batch / fallback HTTP endpoint: `POST /api/exams/:examId/proctoring/frame`.
- **At-Rest Protection**:
  - Gaze and landmark coordinate payloads must be encrypted with `encrypt(JSON.stringify(details))` (`src/lib/crypto.ts`) and persisted in `ProctoringEvent.detailsEncrypted`.

### D. Invigilator Notification
- Emit real-time flagged alerts over WebSocket or make available to the admin polling feed at `GET /api/exams/:examId/proctoring/alerts`.

---

## 4. Unit Testing Guide

Recommended test runner: **Vitest** or **Jest** (`ts-jest`).

### What to Mock
- `src/config/db.ts` (`prisma`): Mock database queries (`prisma.user.findUnique`, `create`, `update`, `prisma.session.*`).
- `jsonwebtoken`: Mock `jwt.sign` and `jwt.verify`.
- `argon2`: Mock `argon2.hash` and `argon2.verify`.
- `otplib`: Mock `generateSecret`, `generateURI`, and `verifySync`.

### Critical Test Cases

#### 1. Cryptography (`src/lib/crypto.test.ts`)
- `encrypt()` should return format `iv.tag.ciphertext` (three Base64 strings separated by dots).
- `decrypt()` should restore the original plaintext.
- `decrypt()` should throw an error if the auth tag or ciphertext is tampered with.

#### 2. JWT & Tokens (`src/lib/jwt.test.ts`)
- `signAccessToken()` returns a valid JWT string containing expected claims (`userId`, `role`).
- `verifyAccessToken()` successfully decodes payload for valid token.
- `verifyAccessToken()` throws for expired or invalid signatures.
- `generateRefreshToken()` produces a 64-character hex string (32 bytes).
- `hashRefreshToken()` produces consistent SHA-256 hex digest.

#### 3. TOTP (`src/lib/totp.test.ts`)
- `generateTotpSecret()` returns a valid Base32 secret and an `otpauth://` URI with issuer `NITK-OnlineExam`.
- `encryptTotpSecret()` and `decryptTotpSecret()` roundtrip correctly.
- `verifyTotpCode()` returns `true` for a matching code and `false` for an invalid code.

#### 4. Auth Middleware (`src/middleware/auth.middleware.test.ts`)
- Rejects requests without `Authorization` header with `401 Unauthorized`.
- Rejects requests with malformed tokens (not starting with `Bearer `) with `401 Unauthorized`.
- Attaches `req.user = { id, role }` and calls `next()` when token is valid.

#### 5. RBAC Middleware (`src/middleware/rbac.middleware.test.ts`)
- Calls `next()` when `req.user.role` matches the required role (e.g. `ADMIN`).
- Returns `403 Forbidden` (`AppError`) when candidate accesses admin route.
- Returns `401 Unauthorized` if `req.user` is not set.

#### 6. Request Validation Middleware (`src/middleware/validate.middleware.test.ts`)
- Calls `next()` when `req.body`, `req.query`, or `req.params` satisfy the Zod schema.
- Returns `400 Bad Request` with field-level issues when validation fails.

#### 7. Centralized Error Handler (`src/middleware/errorHandler.middleware.test.ts`)
- Returns `AppError.statusCode` with `{ error: { code, message, details } }`.
- Returns `500` with generic `INTERNAL_ERROR` message for unexpected native errors in production.

#### 8. Auth Service (`src/modules/auth/service.test.ts`)
- **Register**: Prevents duplicate email/rollNumber (`ConflictError`); hashes password before insert.
- **Login**: Increments `failedLoginAttempts` on wrong password; sets `isLocked = true` when attempt limit is exceeded.
- **2FA**: Enforces TOTP verification during login; creates rotating `Session` entry with hashed refresh token.
- **Refresh**: Invalidates old session and issues new token pair.
