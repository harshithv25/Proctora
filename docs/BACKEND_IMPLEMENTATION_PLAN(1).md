# Backend Implementation Plan
### Real-Time Online Examination System with Proctoring and Suspicious Event Detection

This document is the backend implementation plan derived from the SRS, DFD, and Structure Chart. It scopes **only** the foundational layer: authentication, middleware, routing skeleton, error handling, CSRF protection, encryption/decryption, and the PostgreSQL schema. Feature logic inside each module (AI proctoring inference, telemetry replay UI, report generation, etc.) is intentionally out of scope for this pass — this is the scaffold everything else gets built on.

> Note: the SRS lists Firebase as the reference cloud DB (Section 3.2.3). This plan implements the same data-store role with **PostgreSQL** instead, since the system needs relational integrity across candidates, seating plans, and telemetry that a document DB doesn't enforce well. Real-time delivery (alerts, telemetry streaming) is handled over WebSockets independent of the DB choice, so this substitution doesn't violate DC.1–DC.4.

---

## 1. Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js (LTS) + Express | Matches decoupled frontend/backend constraint (DC.1), team familiarity |
| Language | TypeScript | Schema/DTO safety across auth, telemetry, and proctoring payloads |
| DB | PostgreSQL | Relational integrity for seating plans, sessions, accommodations |
| ORM | Prisma | Type-safe models, migrations, fits Postgres well |
| Auth | JWT (access + refresh) + TOTP-based 2FA | Matches F.1; stateless access tokens, rotating refresh tokens |
| Real-time | ws (WebSocket) | Required for telemetry/proctoring streaming (Section 3.2.4) |
| Validation | Zod | Request schema validation before controllers run |
| Password hashing | Argon2id | Stronger than bcrypt against GPU cracking, used for credentials |
| Symmetric encryption | AES-256-GCM (Node `crypto`) | Encrypts sensitive telemetry/proctoring payloads at rest |
| CSRF | Double-submit cookie pattern + `csrf-csrf` | Works cleanly with a decoupled SPA + cookie-based refresh tokens |
| Rate limiting | `express-rate-limit` (in-memory store) | Protects F.1 login/2FA endpoints from brute force (per C.3) |

---

## 2. Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── env.ts               # validated env loading (zod)
│   │   └── db.ts                 # Prisma client singleton
│   ├── middleware/
│   │   ├── auth.middleware.ts        # JWT verify + attach req.user
│   │   ├── rbac.middleware.ts        # role gate (candidate/admin)
│   │   ├── csrf.middleware.ts        # double-submit CSRF check
│   │   ├── rateLimit.middleware.ts   # per-route limiters
│   │   ├── validate.middleware.ts    # zod schema validator
│   │   └── errorHandler.middleware.ts# centralized error responses
│   ├── modules/
│   │   ├── auth/                 # F.1 — 0.1.1, 0.1.2, 0.1.3
│   │   ├── examConfig/           # F.3, F.11 — 0.2.x
│   │   ├── examDelivery/         # F.2, F.3, F.10 — 0.3.x
│   │   ├── integrityMonitoring/  # F.4, F.5, F.6, F.8, F.12 — 0.4.x
│   │   └── evaluationExport/     # F.7, F.9 — 0.5.x
│   ├── lib/
│   │   ├── crypto.ts             # AES-256-GCM encrypt/decrypt helpers
│   │   ├── jwt.ts                # sign/verify access + refresh tokens
│   │   ├── totp.ts               # 2FA secret gen + OTP verify
│   │   └── apiError.ts           # typed AppError class
│   ├── routes/
│   │   └── index.ts              # mounts all module routers
│   ├── app.ts                    # express app, middleware wiring
│   └── server.ts                 # http + ws server bootstrap
├── prisma/
│   └── schema.prisma
├── .env.example
└── package.json
```

Each `modules/<name>/` folder holds its own `router.ts`, `controller.ts`, `service.ts`, and `schema.ts` (zod), keeping the DFD module boundaries intact per the SRS's maintainability requirement.

---

## 3. Environment Configuration (`config/env.ts`)

All secrets are loaded once, validated with Zod, and never read from `process.env` directly elsewhere.

```ts
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().url(),          // postgresql://user:pass@host:5432/db

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  AES_ENCRYPTION_KEY: z.string().length(64), // 32-byte hex key
  CSRF_SECRET: z.string().min(32),

  TOTP_ISSUER: z.string().default("NITK-OnlineExam"),
});

export const env = EnvSchema.parse(process.env);
```

`.env.example` ships with placeholders only — no real secrets committed.

---

## 4. PostgreSQL Connection (`config/db.ts`)

Single Prisma client instance, reused across the app (avoids connection-pool exhaustion in dev with hot reload):

```ts
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") global.__prisma = prisma;
```

Connection pooling itself is delegated to Prisma's built-in pool (backed by `pg`), sized via `connection_limit` on `DATABASE_URL` — set to match expected concurrent exam sessions per NF.2 (Availability).

---

## 5. Database Schema (Prisma models)

Maps directly to the Level-1/Level-2 DFD data stores (all currently collapsed into one logical `D1 Cloud Database`, now normalized into relational tables).

```prisma
// prisma/schema.prisma

enum Role {
  CANDIDATE
  ADMIN
}

model User {
  id           String   @id @default(uuid())
  role         Role
  name         String
  email        String   @unique
  rollNumber   String?  @unique          // candidates only
  passwordHash String
  totpSecret   String?                    // encrypted at rest
  isLocked     Boolean  @default(false)   // F.1 lockout after repeated failures
  failedLoginAttempts Int @default(0)
  createdAt    DateTime @default(now())

  sessions          Session[]
  examResponses     ExamResponse[]
  accommodations    Accommodation[]
  proctoringEvents  ProctoringEvent[]
  focusLogs         FocusLog[]
  editorTelemetry   EditorTelemetryEvent[]
}

model Session {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  refreshToken String   @unique           // hashed, not raw
  userAgent    String?
  ipAddress    String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())
}

model Exam {
  id            String   @id @default(uuid())
  title         String
  startTime     DateTime
  endTime       DateTime
  idleTimeoutSec Int     @default(300)     // C.7
  createdBy     String
  createdAt     DateTime @default(now())

  questions       Question[]
  seatingPlan     SeatingAssignment[]
  responses       ExamResponse[]
  accommodations  Accommodation[]
}

model Question {
  id       String @id @default(uuid())
  examId   String
  exam     Exam   @relation(fields: [examId], references: [id])
  content  String
  type     String   // "mcq" | "code"
  metadata Json?
}

model SeatingAssignment {
  id         String @id @default(uuid())
  examId     String
  exam       Exam   @relation(fields: [examId], references: [id])
  rollNumber String
  seatRow    Int
  seatCol    Int
  questionSetId String?
}

model Accommodation {
  id             String   @id @default(uuid())
  examId         String
  exam           Exam     @relation(fields: [examId], references: [id])
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  extraTimeSec   Int
  approvedBy     String
  createdAt      DateTime @default(now())
}

model ExamResponse {
  id           String   @id @default(uuid())
  examId       String
  exam         Exam     @relation(fields: [examId], references: [id])
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  answers      Json                       // encrypted blob for code/free-text
  submittedVia String                     // "manual" | "timer_expiry" | "auto_logout"
  submittedAt  DateTime @default(now())
}

model ProctoringEvent {
  id              String   @id @default(uuid())
  examId          String
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  cheatProbability Float
  windowStart     DateTime
  windowEnd       DateTime
  flagged         Boolean  @default(false)
  detailsEncrypted String                 // AES-GCM ciphertext of gaze/head-pose data
  createdAt       DateTime @default(now())
}

model FocusLog {
  id         String   @id @default(uuid())
  examId     String
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  eventType  String   // "blur" | "focus" | "visibility_hidden"
  timestamp  DateTime @default(now())
}

model EditorTelemetryEvent {
  id         String   @id @default(uuid())
  examId     String
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  eventType  String   // "keystroke" | "paste" | "run" | "submit"
  payload    Json                          // text delta, cursor pos, etc.
  timestamp  DateTime @default(now())
}
```

Data retention (NF.4 / C.4) is enforced with a scheduled job (not covered here) that purges `ProctoringEvent` and `EditorTelemetryEvent` rows past the institutional review window — the schema itself just needs the `createdAt`/`timestamp` columns to key off.

---

## 6. Authentication (F.1)

- **Registration** (`POST /api/auth/register`): candidate submits name + roll number/email → `Argon2id` hash on password → row created in `User`.
- **2FA enrollment** (`POST /api/auth/2fa/setup`): generate TOTP secret (`otplib`), encrypt with AES-256-GCM before storing in `totpSecret`, return QR payload.
- **Login** (`POST /api/auth/login`): verify password → verify TOTP code → issue access token (short-lived JWT) + refresh token (random 256-bit value, hashed and stored in `Session`, set as `httpOnly`, `Secure`, `SameSite=Strict` cookie).
- **Lockout**: `failedLoginAttempts` incremented on any failed step; past a threshold, `isLocked` is set and login is rejected until a cooldown or admin reset — satisfies F.1's "repeated failed attempts trigger a temporary lockout."
- **Refresh** (`POST /api/auth/refresh`): rotates refresh token (old one invalidated, new one issued) — mitigates replay.
- **Admin accounts**: same table, `role = ADMIN`, created only via a separate seeded/admin-only route — never through public registration (Section 2.3).

`lib/jwt.ts` and `lib/totp.ts` hold the actual signing/verification logic; controllers stay thin.

---

## 7. Middleware

| Middleware | Responsibility |
|---|---|
| `auth.middleware.ts` | Reads `Authorization: Bearer <token>`, verifies JWT signature + expiry, attaches `req.user = { id, role }`. Rejects with `401` on missing/invalid token. |
| `rbac.middleware.ts` | `requireRole("ADMIN")` factory — checks `req.user.role`, `403` on mismatch. Used on all `examConfig`/export/admin-review routes. |
| `csrf.middleware.ts` | Validates the double-submit CSRF token on all state-changing requests (see §8). |
| `rateLimit.middleware.ts` | In-memory limiter, tighter window on `/auth/login` and `/auth/2fa/*` (per C.3 — protect against brute force without degrading normal load). Note: an in-memory store resets on restart and doesn't share state across multiple instances — fine for a single-process deployment, but would need a shared store (e.g. Postgres-backed or Redis) if the app ever scales horizontally. |
| `validate.middleware.ts` | `validate(schema)` factory — parses `req.body`/`req.params`/`req.query` against a Zod schema, `400` with field-level errors on failure. |
| `errorHandler.middleware.ts` | Final Express error handler — see §9. |

Ordering in `app.ts`: `helmet` → `cors` (locked to frontend origin, `credentials: true`) → `cookie-parser` → body parsers → rate limiter → CSRF → routes → 404 handler → `errorHandler`.

---

## 8. CSRF Protection

Since the refresh token lives in an `httpOnly` cookie, the app is exposed to CSRF on any cookie-authenticated state-changing route. Double-submit pattern:

1. On login/session start, server sets a `csrfToken` cookie (readable by JS, **not** `httpOnly`) alongside the `httpOnly` refresh-token cookie.
2. Frontend reads the `csrfToken` cookie and sends it back in an `X-CSRF-Token` header on every mutating request.
3. `csrf.middleware.ts` compares the header value against the cookie value (HMAC-signed with `CSRF_SECRET` to prevent forgery) — mismatch → `403`.
4. GET/HEAD/OPTIONS requests are exempt; every `POST/PUT/PATCH/DELETE` route runs through this middleware.

This is applied globally rather than per-route so no new route can accidentally skip it.

---

## 9. Centralized Error Handling

`lib/apiError.ts`:

```ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,       // machine-readable, e.g. "AUTH_INVALID_2FA"
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}
```

`errorHandler.middleware.ts` catches both `AppError` (known, mapped to its `statusCode`) and unexpected exceptions (logged, returned as generic `500` — never leaking stack traces in production). Response shape is consistent across the API:

```json
{
  "error": {
    "code": "AUTH_INVALID_2FA",
    "message": "The provided one-time code is invalid or expired.",
    "details": null
  }
}
```

All controllers `throw` `AppError` instances or call `next(err)` — no manual `res.status().json()` error replies scattered through the codebase, keeping error format enforceable in one place (supports NF.5 auditability — every rejected admin action logs `code` + `req.user.id` + timestamp before responding).

---

## 10. Encryption / Decryption (`lib/crypto.ts`)

AES-256-GCM for anything sensitive at rest: TOTP secrets, proctoring detail payloads (`ProctoringEvent.detailsEncrypted`), and exam response blobs.

```ts
import crypto from "node:crypto";
import { env } from "../config/env";

const KEY = Buffer.from(env.AES_ENCRYPTION_KEY, "hex"); // 32 bytes

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map(b => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    KEY,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
```

Passwords never go through this — they're one-way hashed with Argon2id (`argon2.hash` / `argon2.verify`), never decrypted.

---

## 11. Route Map

All routes prefixed `/api`. Grouped by DFD module; auth + role requirements noted.

### `auth/router.ts` — F.1
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | none | rate-limited |
| POST | `/auth/2fa/setup` | access token | |
| POST | `/auth/login` | none | rate-limited, tracks failed attempts |
| POST | `/auth/refresh` | refresh cookie | rotates token |
| POST | `/auth/logout` | access token | invalidates session row |
| POST | `/auth/admin/create` | ADMIN | seed-only / super-admin gated |

### `examConfig/router.ts` — F.3, F.11
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/exams` | ADMIN | create exam |
| POST | `/exams/:examId/questions` | ADMIN | upload question bank |
| POST | `/exams/:examId/seating-plan` | ADMIN | roll number → seat mapping |
| POST | `/exams/:examId/accommodations` | ADMIN | grant extended time |

### `examDelivery/router.ts` — F.2, F.3, F.10, F.11
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/exams/:examId/device-check` | CANDIDATE | returns pass/fail diagnostics |
| GET | `/exams/:examId/questions` | CANDIDATE | seating-shuffled or randomized set |
| POST | `/exams/:examId/fullscreen-event` | CANDIDATE | enter/exit logging |
| GET | `/exams/:examId/session-config` | CANDIDATE | includes applied accommodation timer |

### `integrityMonitoring/router.ts` — F.4, F.5, F.6, F.8, F.12
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/exams/:examId/proctoring/frame` | CANDIDATE | or WS stream, see below |
| POST | `/exams/:examId/telemetry/editor` | CANDIDATE | keystroke/paste/run events |
| POST | `/exams/:examId/focus-event` | CANDIDATE | blur/focus/visibility |
| GET | `/exams/:examId/proctoring/alerts` | ADMIN | real-time feed (WS preferred) |
| POST | `/exams/:examId/sessions/:userId/auto-logout` | system/internal | idle-timeout trigger |

High-frequency streams (video-derived proctoring scores, editor telemetry) are pushed over a **WebSocket** channel (`/ws/exam/:examId`) rather than polling REST, per Section 3.2.4 — the REST routes above serve as the fallback/batch ingestion path and for admin polling clients.

### `evaluationExport/router.ts` — F.7, F.9
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/exams/:examId/responses/autosave` | CANDIDATE | in-progress save |
| POST | `/exams/:examId/responses/submit` | CANDIDATE | manual or timer-triggered |
| GET | `/exams/:examId/export` | ADMIN | CSV/PDF, scoped by query params |

---

## 12. What's Deliberately Out of Scope Here

- AI proctoring model inference (F.4's ML pipeline itself)
- Admin dashboard UI / review player
- Report generation formatting (CSV/PDF templating)
- Data-retention purge cron job (schema supports it; job itself isn't built)
- WebSocket message contracts (channel is named above; payload schemas TBD)

This plan covers everything needed to stand up a working, secured API skeleton that every one of those features can be layered onto without restructuring auth, data access, or error handling later.
