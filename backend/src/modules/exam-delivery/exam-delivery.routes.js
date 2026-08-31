const express = require('express');
const examDeliveryController = require('./exam-delivery.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

const router = express.Router();

router.post('/start-session', authenticateToken, (req, res, next) => examDeliveryController.startOrResumeSession(req, res, next));
router.post('/diagnostics', authenticateToken, (req, res, next) => examDeliveryController.submitDiagnostics(req, res, next));
router.post('/launch', authenticateToken, (req, res, next) => examDeliveryController.launchExam(req, res, next));

module.exports = router;
