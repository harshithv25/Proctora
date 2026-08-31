const express = require('express');
const evaluationExportController = require('./controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { requireAdmin, requireCandidate } = require('../../middleware/rbac.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { AutosaveSchema, FinalizeSubmitSchema } = require('./schema');

const router = express.Router();

// Candidate endpoints
router.post('/responses/autosave', authenticateToken, requireCandidate, validate(AutosaveSchema), (req, res, next) => evaluationExportController.autosave(req, res, next));
router.post('/responses/submit', authenticateToken, requireCandidate, validate(FinalizeSubmitSchema), (req, res, next) => evaluationExportController.finalizeSubmit(req, res, next));

// Admin export endpoints
router.get('/export', authenticateToken, requireAdmin, (req, res, next) => {
    const { examId, format } = req.query;
    if (!examId) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'examId query param is required' } });
    if (format === 'pdf') return evaluationExportController.exportPDF(req, res, next);
    return evaluationExportController.exportCSV(req, res, next);
});

module.exports = router;
