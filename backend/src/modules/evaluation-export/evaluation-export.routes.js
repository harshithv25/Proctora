const express = require('express');
const evaluationExportController = require('./evaluation-export.controller');
const { authenticateToken, requireAdmin } = require('../../middleware/auth.middleware');

const router = express.Router();

// Candidate endpoints for response autosave and submission
router.post('/autosave', authenticateToken, (req, res, next) => evaluationExportController.autosave(req, res, next));
router.post('/submit', authenticateToken, (req, res, next) => evaluationExportController.finalizeSubmit(req, res, next));

// Admin endpoints for CSV & PDF reports export
router.get('/export/csv/:examId', authenticateToken, requireAdmin, (req, res, next) => evaluationExportController.exportCSV(req, res, next));
router.get('/export/pdf/:examId', authenticateToken, requireAdmin, (req, res, next) => evaluationExportController.exportPDF(req, res, next));

module.exports = router;
