# Proctora Cloud Deployment Guide 🌐
### Production Deployment: Frontend on Vercel, Backend & AI Microservice on Render, Managed PostgreSQL

This guide provides end-to-end, copy-pasteable instructions for deploying the complete Proctora online examination architecture to the cloud:
* **Frontend:** Svelte 5 SPA on **Vercel**
* **Database:** Managed PostgreSQL 16 on **Render** (or Neon / Supabase)
* **Backend:** Express 5 / Prisma / TypeScript API on **Render**
* **AI Model Engine:** FastAPI / YOLOv8 Pose Microservice on **Render** (via Docker or Python)

---

## 🏛️ Cloud Architecture Overview

```text
                  ┌─────────────────────────────────────────────────────────┐
                  │                 Vercel Edge Network                     │
                  │              (https://proctora.vercel.app)              │
                  │   Svelte 5 SPA + Monaco Editor + Webcam / Fullscreen    │
                  └───────────────┬─────────────────────────┬───────────────┘
                                  │                         │
                  REST / Auth     │                         │ AI Frames
                  Cookies         │                         │ (2.5s loop)
                                  ▼                         ▼
            ┌───────────────────────────┐             ┌───────────────────────────┐
            │       Render Web Service  │             │    Render Web Service     │
            │        proctora-backend   │             │        proctora-ai        │
            │  (Express 5, Node.js 20,  │             │   (FastAPI, Python 3.11,  │
            │   Prisma, WebSockets)     │             │    YOLOv8 Pose, OpenCV)   │
            └─────────────┬─────────────┘             └───────────────────────────┘
                          │ Internal Connection
                          │ (SSL: require)
                          ▼
            ┌───────────────────────────┐
            │   Render Managed Database │
            │         proctora-db       │
            │      (PostgreSQL 16)      │
            └───────────────────────────┘
```

---

## 🗄️ Phase 1: Deploy the Managed PostgreSQL Database

You can provision a managed PostgreSQL database directly on **Render** (free or starter tier), or on **Neon** / **Supabase**.

### Step 1.1: Create Database on Render
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **"New +"** in the top navigation bar and select **"PostgreSQL"**.
3. Configure settings:
   * **Name:** `proctora-db`
   * **Database:** `proctora`
   * **User:** `proctora_user`
   * **Region:** Choose the region closest to your users (e.g., `Frankfurt (EU Central)` or `Oregon (US West)`).
   * **PostgreSQL Version:** `16`
   * **Instance Type:** `Free` or `Starter`
4. Click **"Create Database"**.
5. Once provisioned (approx. 30 seconds), copy the connection strings:
   * **Internal Database URL** (for backend running within Render): `postgresql://proctora_user:...@dpg-...-a:5432/proctora`
   * **External Database URL** (for initial migrations and seeds from local machine): `postgresql://proctora_user:...@dpg-...-a.render.com/proctora?sslmode=require`

### Step 1.2: Initialize Schema & Seed Data
From your local terminal, initialize the remote database schema:

```bash
cd backend

# Temporarily point DATABASE_URL to your Render External Database URL
export DATABASE_URL="postgresql://proctora_user:PASSWORD@dpg-xxxx.render.com/proctora?sslmode=require"

# 1. Push schema tables (Users, Exams, Questions, Logs, Seating, Telemetry)
npx prisma db push

# 2. Seed initial Administrator & Super Administrator accounts
npx tsx prisma/seed.ts

# 3. Seed Morgan Stanley OA test fixtures (10 questions + seating map)
npm run seed:oa
```

---

## ⚙️ Phase 2: Deploy the Backend API on Render

The backend is an Express 5 + TypeScript server with Prisma ORM and WebSockets.

### Step 2.1: Create Render Web Service
1. In Render Dashboard, click **"New +"** -> **"Web Service"**.
2. Connect your GitHub repository (`harshithv25/Proctora`).
3. Configure the service settings:
   * **Name:** `proctora-backend`
   * **Region:** Same region as your database
   * **Branch:** `main` (or your active branch)
   * **Root Directory:** `backend`
   * **Runtime:** `Node`
   * **Build Command:**
     ```bash
     npm install --include=dev && npx prisma generate && npm run build
     ```
   * **Pre-Deploy Command:**  
     *Leave **EMPTY / BLANK*** (Pre-deploy commands require a paid plan on Render. Your database schema is already synchronized via `npx prisma db push`).
   * **Start Command:**
     ```bash
     npm start
     ```
     *(Or on Free tier, if you ever want auto-sync on boot: `npx prisma db push && npm start`)*
   * **Instance Type:** `Free` or `Starter`

### Step 2.2: Configure Backend Environment Variables
Under the **"Environment Variables"** tab on Render, add the following:

| Variable | Recommended Production Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security & strict cookies |
| `PORT` | `10000` | Render assigns port dynamically; default is 10000 |
| `DATABASE_URL` | *Internal Database URL from Phase 1* | Connection string to `proctora-db` |
| `JWT_ACCESS_SECRET` | *(Generate a 32+ character random string)* | Secret for short-lived access tokens |
| `JWT_REFRESH_SECRET` | *(Generate a 32+ character random string)* | Secret for refresh tokens |
| `JWT_ACCESS_TTL` | `15m` | Access token lifespan |
| `JWT_REFRESH_TTL` | `7d` | Refresh token lifespan |
| `AES_ENCRYPTION_KEY` | *(Generate a 64-character hex string)* | 32-byte key for encrypting proctoring telemetry |
| `CSRF_SECRET` | *(Generate a 32+ character random string)* | Double-submit CSRF cookie secret |
| `TOTP_ISSUER` | `NITK-Proctora` | App name displayed in Google Authenticator |
| `CLIENT_URL` | `https://your-app.vercel.app` | Allowed CORS origin (your Vercel URL) |

> [!TIP]
> **Generating Cryptographic Keys in Linux / macOS Terminal:**
> ```bash
> # 64-hex-character AES key:
> openssl rand -hex 32
> 
> # 32-character secrets:
> openssl rand -base64 32
> ```

4. Click **"Save Changes"**. Render will trigger the build and deploy.
5. Once deployed, test the health check URL in your browser:  
   `https://proctora-backend.onrender.com/api/health`  
   *(Expected response: `{"status":"ok","timestamp":"..."}`)*

---

## 🤖 Phase 3: Deploy the AI Proctoring Microservice on Render

The AI microservice performs YOLOv8 Pose facial detection and 3D head pose estimation. To avoid Python environment inconsistencies, deploy it using the provided [`ai-service/Dockerfile`](file:///home/harshith/dev/Proctora/ai-service/Dockerfile).

### Step 3.1: Create AI Web Service
1. In Render Dashboard, click **"New +"** -> **"Web Service"**.
2. Select your repository (`harshithv25/Proctora`).
3. Configure the settings:
   * **Name:** `proctora-ai`
   * **Region:** Same region as backend
   * **Root Directory:** `ai-service`
   * **Runtime:** `Docker` (Render will automatically detect `ai-service/Dockerfile`)
   * **Instance Type:** `Starter` (recommended for PyTorch / YOLOv8 memory requirements)
4. Click **"Create Web Service"**.

### Step 3.2: Verify AI Microservice
Once the container finishes building, verify it in your browser:
* OpenAPI Documentation: `https://proctora-ai.onrender.com/docs`
* Pre-flight Check: Send a test ping to `https://proctora-ai.onrender.com/`

---

## 💻 Phase 4: Deploy the Frontend on Vercel

The frontend is a Vite-powered Svelte 5 Single Page Application.

### Step 4.1: Import Project in Vercel
1. Log in to [Vercel](https://vercel.com) and click **"Add New..."** -> **"Project"**.
2. Import your GitHub repository (`harshithv25/Proctora`).
3. In the project configuration modal:
   * **Framework Preset:** `Vite`
   * **Root Directory:** Click **Edit** and select `frontend`
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
   * **Install Command:** `npm install`

### Step 4.2: Configure Environment Variables on Vercel
In the **Environment Variables** section, add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `/api` | Base path for Express API requests |
| `VITE_AI_URL` | `/ai-proctor` | Base path for AI frame analysis |
| `VITE_WS_URL` | `wss://proctora-backend.onrender.com/ws` | WebSocket connection for real-time telemetry |

---

## 🔄 Phase 5: Connect Frontend to Backend (Two Routing Options)

### Option A: Reverse-Proxy Rewrites via `vercel.json` (Recommended — Zero CORS / Cookie Issues)
By proxying `/api` and `/ai-proctor` directly through Vercel's edge network to Render, the browser treats all requests as **same-origin**:
* HttpOnly cookies (`refreshToken`, CSRF cookies) work with `SameSite: strict` without being blocked by Safari or Chrome third-party cookie restrictions.
* No CORS preflight latency.

In [`frontend/vercel.json`](file:///home/harshith/dev/Proctora/frontend/vercel.json), set your actual Render service names:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/:match*",
      "destination": "https://proctora-backend.onrender.com/api/:match*"
    },
    {
      "source": "/ai-proctor/:match*",
      "destination": "https://proctora-ai.onrender.com/:match*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Option B: Direct Cross-Origin Requests
If you prefer direct calls without Vercel rewrites:
1. In Vercel Environment Variables:
   * `VITE_API_BASE_URL=https://proctora-backend.onrender.com/api`
   * `VITE_AI_URL=https://proctora-ai.onrender.com`
2. In Render Backend Environment Variables:
   * Ensure `CLIENT_URL=https://your-app.vercel.app` is set to your exact Vercel production domain.
3. Keep the fallback SPA rewrite in `frontend/vercel.json`:
   ```json
   {
     "rewrites": [
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```

---

## ⚡ Quick 1-Click Alternative: Render Blueprint (`render.yaml`)

You can provision the **Database, Backend API, and AI Microservice together** on Render in one step using the included [`render.yaml`](file:///home/harshith/dev/Proctora/render.yaml):

1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **"New +"** -> **"Blueprint"**.
3. Select your repository (`Proctora`). Render will automatically detect [`render.yaml`](file:///home/harshith/dev/Proctora/render.yaml).
4. Review the plan and click **"Apply"**.
5. Once deployed, copy your backend and AI URLs and configure your Vercel frontend.

---

## 🔍 Phase 6: Post-Deployment Smoke Test Checklist

Once both Vercel and Render services are live, verify the complete lifecycle:

1. **SPA Routing Test:**
   * Open `https://your-app.vercel.app/login`.
   * Press browser refresh (`F5`). Verify the page does not 404.
2. **Super Admin Access:**
   * Sign in with `superadmin@proctora.edu` / `SuperAdmin@12345`.
   * Verify redirect to `/super-admin`.
   * Check that live metrics, log table, and 8-second auto-polling function without errors.
3. **Faculty / Admin Portal:**
   * Sign in with `admin@proctora.edu` / `Admin@12345`.
   * Verify test list displays Morgan Stanley OA (`TEST-MS2026`).
4. **Candidate Examination Flow:**
   * Sign in with `student@proctora.edu` / `Student@12345`.
   * Complete Device Check (webcam feed and AI face calibration indicator).
   * Enter test `TEST-MS2026`, write answers, and submit.
   * Verify real-time logs reflect `test_attempt` and `test_finish` in the Super Admin dashboard.
