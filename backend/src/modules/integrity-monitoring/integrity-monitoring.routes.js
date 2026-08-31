const express = require('express');
const integrityMonitoringController = require('./integrity-monitoring.controller');
const { authenticateToken, requireAdmin } = require('../../middleware/auth.middleware');

const router = express.Router();

// Live candidate monitoring endpoints
router.post('/proctor-frame', authenticateToken, (req, res, next) => integrityMonitoringController.logProctorFrame(req, res, next));
router.post('/telemetry', authenticateToken, (req, res, next) => integrityMonitoringController.logTelemetry(req, res, next));
router.post('/focus-event', authenticateToken, (req, res, next) => integrityMonitoringController.logFocusEvent(req, res, next));

// Admin-facing playback and system automated check endpoints
router.get('/playback/:sessionId', authenticateToken, requireAdmin, (req, res, next) => integrityMonitoringController.getPlayback(req, res, next));
router.post('/check-idle', authenticateToken, requireAdmin, (req, res, next) => integrityMonitoringController.triggerAutoLogoutCheck(req, res, next));

module.exports = router;
