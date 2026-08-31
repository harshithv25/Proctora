const express = require('express');
const examDeliveryController = require('./controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { requireCandidate } = require('../../middleware/rbac.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { DeviceCheckSchema, StartSessionSchema, LaunchExamSchema } = require('./schema');

const router = express.Router();

router.post('/device-check', authenticateToken, requireCandidate, validate(DeviceCheckSchema), (req, res, next) => examDeliveryController.submitDiagnostics(req, res, next));
router.post('/start-session', authenticateToken, requireCandidate, validate(StartSessionSchema), (req, res, next) => examDeliveryController.startSession(req, res, next));
router.post('/launch', authenticateToken, requireCandidate, validate(LaunchExamSchema), (req, res, next) => examDeliveryController.launchExam(req, res, next));
router.post('/:examId/sessions/:userId/auto-logout', authenticateToken, (req, res, next) => examDeliveryController.autoLogoutSession(req, res, next));

module.exports = router;
