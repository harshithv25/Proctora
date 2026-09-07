# Proctora 🛡️
### Real-Time Online Examination System with Proctoring and Suspicious Event Detection

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518.0.0-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-5-orange.svg)](https://svelte.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)

---

## 📌 Executive Summary

**Proctora** is a full-featured, real-time online assessment and programming contest platform designed to guarantee academic integrity in remote and computer-lab examinations. Developed as a Software Engineering Course Project at the **Department of Information Technology, National Institute of Technology Karnataka (NITK), Surathkal**, Proctora delivers a robust, browser-only testing environment with zero client-side installation requirements.

The platform combines continuous automated AI proctoring, sustained temporal behavioral analysis (to minimize false positives), seating-plan-based question shuffling, browser focus and fullscreen lockdown enforcement, and frame-by-frame code editor telemetry streaming.

---

## 👥 Authors & Academic Context

* **Adarsh Bellamane** (241IT004)
* **Harshith Vellapha** (241IT033)
* **Rushi Hiren Patel** (241IT065)

**Institution:** Department of Information Technology, National Institute of Technology Karnataka, Surathkal  
**Project:** Software Engineering Course Project  
**Specification Version:** 1.0 (Based on IEEE Std 830-1998 SRS & DFD/Structure Chart Specifications)

---

## 🚀 Key Features

### 🔐 1. Authentication & Candidate Verification
* **Two-Factor Authentication (2FA):** Mandatory TOTP / authenticator app tokens using secure RFC 6238 standards.
* **Role-Based Access Control (RBAC):** Distinct interfaces and cryptographic permissions for Candidates and Faculty/Administrators.
* **Brute-Force Protection:** Intelligent lockout thresholds for repeated failed authentication attempts.

### 💻 2. Pre-Flight Device Diagnostics
* **Automated Hardware Checks:** Live diagnostics for webcam video feed, microphone audio capture, supported browser versions, and bandwidth adequacy.
* **Remediation Guidance:** Clear troubleshooting suggestions if devices are inaccessible or below operational thresholds.

### 🪑 3. Seating-Plan-Aware Question Shuffling
* **Physical Seating Deconfliction:** Upload physical classroom seating maps (row/column coordinates) to guarantee adjacent candidates receive non-identical question sequences or question pools.
* **Standard Randomization:** Fallback pseudo-random shuffling for remote or unstructured testing scenarios.

### 👁️ 4. AI Proctoring with False-Positive Suppression
* **Temporal Behavioral Windows:** Evaluates behavioral signals across rolling time windows rather than triggering on single-frame anomalies (e.g., natural blinks or momentary glances).
* **Multi-Signal Analysis:** Detects gaze diversion, abnormal head poses, absence of candidate, and presence of unauthorized multiple faces.
* **Confidence Scoring & Real-Time Alerting:** Calculates an aggregate cheating-probability score and transmits alerts instantly to invigilators via WebSockets.

### ⌨️ 5. Code Telemetry & Replay Player
* **Contest-Grade Keystroke Logging:** Records granular typing operations, text deltas, paste volume anomalies, and execution events.
* **Serialized Timeline:** Faculty can scrub through an interactive, frame-by-frame code evolution replay synchronized with proctoring infraction timestamps.

### 🔒 6. Lockdown & Session Integrity
* **Browser Focus Monitoring:** Tracks window blurs, tab switching, and minimized states with timestamped infraction logs.
* **Native Fullscreen Enforcement:** Enforces browser Fullscreen API; flags and logs every exit attempt.
* **Inactivity Auto-Logout:** Bounded idle-timeout terminates abandoned sessions, flags them for review, and frees exam seats.
* **Candidate Accommodations:** Administrators can assign verified accommodations (e.g., extended time multipliers) that adjust exam timers dynamically.
* **Fault-Tolerant Autosave:** Continual background persistence of candidate responses to prevent data loss during transient network interruptions.

---

## 📐 System Architecture

Proctora adheres strictly to a **Decoupled Client-Server Architecture** communicating via RESTful JSON APIs and full-duplex WebSockets over TLS.

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                    Candidate Client                     │
                  │  (Svelte 5 + WebRTC getUserMedia + Fullscreen/Focus API)│
                  └────────────────────────────┬────────────────────────────┘
                                               │ HTTPS / WSS
                                               ▼
┌───────────────────────┐         ┌─────────────────────────┐         ┌────────────────────────┐
│  Administrator Client │◄───────►│     Proctora Backend    │◄───────►│  PostgreSQL Database   │
│  (Live Monitor,       │ HTTPS / │  (Express 5, TypeScript,│ Prisma  │  (Users, Exams, Plans, │
│   Playback, Analytics)│  WSS    │   WebSocket Server, Zod)│  ORM    │   Responses, Telemetry)│
└───────────────────────┘         └─────────────────────────┘         └────────────────────────┘
```

### Module Organization
The codebase is structured around the five core functional modules identified in the SRS and DFD specifications:

| Module | Sub-processes | Description |
| :--- | :--- | :--- |
| **`auth`** | Process 1.0 (1.1, 1.2, 1.3) | Candidate registration, Argon2 password hashing, TOTP 2FA verification, admin privilege assignment. |
| **`examConfig`** | Process 2.0 (2.1, 2.2, 2.3) | Question bank creation, seating plan coordinate mapping, student accommodations. |
| **`examDelivery`** | Process 3.0 (3.1, 3.2, 3.3, 3.4) | Device diagnostics, fullscreen lockdown, dynamic question delivery and timer management. |
| **`integrityMonitoring`** | Process 4.0 (4.1, 4.2, 4.3, 4.4) | Video AI analysis, focus tracking, editor telemetry streaming, alert broadcasts, idle auto-logout. |
| **`evaluationExport`** | Process 5.0 (5.1, 5.2, 5.3) | Periodic response autosaving, finalized exam submission, and CSV/PDF report compilation. |

---

## 🔄 Data Flow Diagrams (DFD)

### Level-0 Context Diagram
```mermaid
flowchart LR
    Candidate([Candidate])
    System((0.0<br/>Proctora Real-Time<br/>Examination System))
    Admin([Administrator])

    Candidate -->|Registration Details, Audio/Video Feed, Responses, Telemetry| System
    System -->|Session Token, Question Sets, Diagnostic Feedback| Candidate

    Admin -->|Question Banks, Seating Maps, Accommodations, Config| System
    System -->|Real-Time Alerts, Scrubbable Telemetry, CSV/PDF Reports| Admin
```

### Level-1 Process Decomposition
```mermaid
flowchart TD
    Candidate([Candidate])
    Admin([Administrator])
    DB[(D1: Database)]

    P1((1.0 Authenticate<br/>& Register))
    P2((2.0 Configure<br/>Exam))
    P3((3.0 Deliver<br/>Exam))
    P4((4.0 Monitor<br/>Integrity))
    P5((5.0 Evaluate<br/>& Export))

    Candidate -->|Credentials & 2FA| P1
    P1 -->|Store User Profile| DB
    P1 -->|Session Token| Candidate

    Admin -->|Questions, Seating Plan, Accommodations| P2
    P2 -->|Save Exam Configuration| DB

    P3 -->|Fetch Questions & Coordinates| DB
    Candidate -->|Diagnostics & Fullscreen Ready| P3
    P3 -->|Shuffled Question Set| Candidate

    Candidate -->|Video Feed, Editor Keystrokes, Focus Events| P4
    P4 -->|Log Telemetry & Infractions| DB
    P4 -->|Real-Time WebSocket Alerts| Admin

    Candidate -->|Autosave & Final Submission| P5
    P5 -->|Persist Completed Exam Data| DB
    P5 -->|Downloadable Reports CSV/PDF| Admin
```

---

## 🛠️ Technology Stack

### Backend
* **Runtime:** Node.js (v18+)
* **Framework:** Express 5 with TypeScript
* **ORM & Database:** Prisma 7 + PostgreSQL (via `@prisma/adapter-pg`)
* **Real-Time Communication:** `ws` (WebSockets)
* **Authentication & Cryptography:** JWT (`jsonwebtoken`), Argon2 (`argon2`), TOTP (`otplib`), AES encryption
* **Security Middleware:** Helmet, CORS, CSRF (`csrf-csrf`), Rate Limiting (`express-rate-limit`), Cookie Parser
* **Schema Validation:** Zod

### Frontend
* **Framework:** Svelte 5 (Vite-powered Single Page Application)
* **Language:** TypeScript
* **Routing:** `svelte-spa-router`
* **Networking:** Axios + Native WebSockets (`ws://` / `wss://`)
* **Browser APIs:** Fullscreen API, Page Visibility API, MediaDevices (`getUserMedia`), Window Focus/Blur

---

## 📂 Repository Structure

```text
Proctora/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma           # Prisma database schema definition
│   ├── src/
│   │   ├── config/                 # Environment and application configuration
│   │   ├── lib/                    # Shared utilities (DB client, crypto, errors)
│   │   ├── middleware/             # Auth guards, role checks, CSRF, rate limiters
│   │   ├── modules/
│   │   │   ├── auth/               # Module 1.0: 2FA & user registration
│   │   │   ├── examConfig/         # Module 2.0: Question banks & seating plans
│   │   │   ├── examDelivery/       # Module 3.0: Device checks & exam player
│   │   │   ├── integrityMonitoring/# Module 4.0: AI proctoring & telemetry
│   │   │   └── evaluationExport/   # Module 5.0: Scoring & CSV/PDF export
│   │   ├── routes/                 # Aggregated API routes
│   │   ├── app.ts                  # Express application setup
│   │   └── server.ts               # Server bootstrapping & WebSocket attach
│   ├── .env.example                # Backend environment template
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/             # Reusable UI components
│   │   ├── lib/                    # API client, WebSocket helpers, utilities
│   │   ├── pages/                  # Application views
│   │   │   ├── LoginPage.svelte
│   │   │   ├── RegisterPage.svelte
│   │   │   ├── TwoFactorSetupPage.svelte
│   │   │   ├── DashboardPage.svelte
│   │   │   ├── DeviceCheckPage.svelte
│   │   │   ├── ExamPortalPage.svelte
│   │   │   ├── ExamSubmittedPage.svelte
│   │   │   ├── AdminExamsPage.svelte
│   │   │   └── AdminMonitorPage.svelte
│   │   ├── stores/                 # Svelte reactive state stores
│   │   ├── App.svelte
│   │   ├── app.css                 # Global styling & layout definitions
│   │   └── main.ts
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                           # SRS, DFDs, and Architecture specifications
└── README.md
```

---

## ⚙️ Installation & Setup Guide

### Prerequisites
* **Node.js**: v18.0.0 or later
* **npm**: v9.0.0 or later
* **PostgreSQL**: v14 or later (running locally or accessible remotely)

---

### 1. Clone the Repository
```bash
git clone https://github.com/harshithv25/Proctora.git
cd Proctora
```

---

### 2. Backend Setup

1. **Navigate to the backend directory and install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Update the variables in `.env` to match your environment:
   ```dotenv
   NODE_ENV=development
   PORT=4000
   DATABASE_URL="postgresql://user:password@localhost:5432/proctora?schema=public"

   JWT_ACCESS_SECRET=your_super_secret_access_jwt_key_here_32_chars
   JWT_REFRESH_SECRET=your_super_secret_refresh_jwt_key_here_32_chars
   JWT_ACCESS_TTL=15m
   JWT_REFRESH_TTL=7d

   AES_ENCRYPTION_KEY=64_hex_chars_representing_32_bytes_of_aes_encryption_key!
   CSRF_SECRET=your_32_character_csrf_secret_string_here!

   TOTP_ISSUER=NITK-Proctora
   CLIENT_URL=http://localhost:5173
   ```

3. **Database Migration & Client Generation:**
   ```bash
   npm run db:migrate
   npm run db:generate
   ```

4. **Start the Backend Development Server:**
   ```bash
   npm run dev
   ```
   The backend API will run at `http://localhost:4000`.

---

### 3. Frontend Setup

1. **Open a new terminal window, navigate to the frontend directory, and install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Run the Frontend Development Server:**
   ```bash
   npm run dev
   ```
   The Vite dev server will launch at `http://localhost:5173`.

---

## 📋 Functional Requirements Matrix (IEEE Std 830-1998)

| ID | Requirement Name | Description | Priority |
| :--- | :--- | :--- | :--- |
| **F.1** | **User Registration & 2FA** | Candidate registration, Argon2 password storage, TOTP two-factor authentication, session token issuance, account lockout on brute force. | High |
| **F.2** | **Device Compatibility Check** | Pre-flight diagnostics for webcam, microphone, network throughput, and browser feature support with remediation steps. | High |
| **F.3** | **Seating-Based Question Shuffling** | Parsing row/col seating charts to distribute non-overlapping or distinct question orders to adjacent candidates; optional standard pool shuffling. | High |
| **F.4** | **AI Proctoring Pipeline** | Continuous video analysis with rolling temporal windows to suppress momentary false-positive alerts while detecting gaze anomalies, absence, or extra persons. | High |
| **F.5** | **Code Telemetry Capture** | Granular capture of editor keystrokes, text deltas, paste anomalies, and code runs for post-exam scrubbing and replay playback. | Medium |
| **F.6** | **Browser Focus Tracking** | Real-time logging of tab blurs, window minimizations, and lost visibility events with aggregated infraction counters. | Medium |
| **F.7** | **Response Autosave & Collection** | Periodic in-flight response synchronization to cloud storage and atomic collection on manual submit or timer expiration. | High |
| **F.8** | **Real-Time Proctoring Alerts** | Instant WebSocket notifications pushed to the Admin Dashboard when candidate infraction scores cross configurable thresholds. | Medium |
| **F.9** | **Results & Report Export** | Aggregation of candidate scores, proctoring timeline flags, and telemetry into downloadable CSV and PDF reports. | Low |
| **F.10** | **Fullscreen Enforcement** | Mandatory activation of browser Fullscreen API prior to exam start; detection and logging of all exit attempts. | Medium |
| **F.11** | **Candidate Accommodations** | Administrator management of individual accommodations (e.g. extra time multipliers), dynamically updating exam session timers. | Medium |
| **F.12** | **Inactivity Auto-Logout** | Automatic termination of abandoned or idle sessions beyond a strict threshold, freeing exam seats and flagging sessions for review. | Medium |

---

## 🔒 Security & Compliance

* **Decoupled Architecture:** Strict separation of client presentation and server validation logic prevents unauthorized state modification.
* **Encrypted Communications:** All transit occurs over TLS/HTTPS and WSS protocols.
* **Session Integrity & Anti-CSRF:** Hardened cookie handling (`SameSite`, `HttpOnly`), CSRF tokens, and short-lived JWT access tokens paired with rotatable refresh tokens.
* **Data Retention & Purging:** Automated data purging policies ensure telemetry and video frames are retained only during the institutional review window.
* **Audit Trail:** Comprehensive administrative logging of all export and override actions with timestamps and operator identity.

---

## 📄 License

This project is licensed under the **ISC License**. See the `LICENSE` file for full terms.
