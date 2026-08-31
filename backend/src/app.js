const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');

const { env } = require('./config/env');
const { csrfProtection } = require('./middleware/csrf.middleware');
const { authRateLimiter, generalRateLimiter } = require('./middleware/rateLimit.middleware');
const { errorHandler } = require('./middleware/errorHandler.middleware');
const apiRouter = require('./routes/index');

const app = express();
const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

// ── 1. helmet (sets secure HTTP headers: CSP, HSTS, X-Frame-Options, etc.) ────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // frontend sets its own CSP; disable for API-only server
}));

// ── 2. CORS — locked to frontend origin, credentials allowed ──────────────────
app.use(cors({
  origin: clientOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// ── 3. Body / Cookie parsers ──────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── 4. Rate limiting applied at app level — covers all auth endpoints (C.3) ──
//      auth routes apply a stricter per-route window on top of this
app.use('/api/auth', authRateLimiter);
app.use(generalRateLimiter);

// ── 5. CSRF protection (double-submit cookie) ─────────────────────────────────
app.use(csrfProtection);

// ── 6. API routes ─────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── 7. Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'Proctora Real-Time Online Examination System',
    mode: env.NODE_ENV,
    modules: ['auth', 'examConfig', 'examDelivery', 'integrityMonitoring', 'evaluationExport'],
    diagnostics: env.NODE_ENV === 'development'
      ? { memory: process.memoryUsage(), platform: process.platform }
      : undefined
  });
});

// ── 8. 404 fallthrough ────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found.` } });
});

// ── 9. Centralized error handler (must be last) ───────────────────────────────
app.use(errorHandler);

module.exports = app;
