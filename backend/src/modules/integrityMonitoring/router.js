const express = require('express');
const integrityMonitoringController = require('./controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { requireAdmin, requireCandidate } = require('../../middleware/rbac.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { ProctorFrameSchema, EditorTelemetrySchema, FocusEventSchema } = require('./schema');

const router = express.Router();

// Candidate ingestion routes
router.post('/proctoring/frame', authenticateToken, requireCandidate, validate(ProctorFrameSchema), (req, res, next) => integrityMonitoringController.processProctorFrame(req, res, next));
router.post('/telemetry/editor', authenticateToken, requireCandidate, validate(EditorTelemetrySchema), (req, res, next) => integrityMonitoringController.recordEditorTelemetry(req, res, next));
router.post('/focus-event', authenticateToken, requireCandidate, validate(FocusEventSchema), (req, res, next) => integrityMonitoringController.recordFocusEvent(req, res, next));

// Admin playback and monitoring review
router.get('/playback/:sessionId', authenticateToken, requireAdmin, (req, res, next) => integrityMonitoringController.getPlayback(req, res, next));
router.post('/auto-logout-check', authenticateToken, requireAdmin, (req, res, next) => integrityMonitoringController.triggerIdleCheck(req, res, next));

module.exports = router;
