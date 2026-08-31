const express = require('express');
const examConfigController = require('./controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { requireAdmin } = require('../../middleware/rbac.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { CreateExamSchema, QuestionUploadSchema, SeatingUploadSchema, AccommodationSchema } = require('./schema');

const router = express.Router();

// Candidate or Admin endpoints
router.get('/', authenticateToken, (req, res, next) => examConfigController.getExams(req, res, next));
router.get('/:examId', authenticateToken, (req, res, next) => examConfigController.getExamDetails(req, res, next));
router.get('/:examId/questions', authenticateToken, (req, res, next) => examConfigController.getExamQuestions(req, res, next));
router.get('/:examId/session-config', authenticateToken, (req, res, next) => examConfigController.getSessionConfig(req, res, next));

// Admin setup endpoints
router.post('/', authenticateToken, requireAdmin, validate(CreateExamSchema), (req, res, next) => examConfigController.createExam(req, res, next));
router.post('/:examId/questions', authenticateToken, requireAdmin, validate(QuestionUploadSchema), (req, res, next) => examConfigController.uploadQuestions(req, res, next));
router.post('/:examId/seating-plan', authenticateToken, requireAdmin, validate(SeatingUploadSchema), (req, res, next) => examConfigController.uploadSeatingPlan(req, res, next));
router.post('/:examId/accommodations', authenticateToken, requireAdmin, validate(AccommodationSchema), (req, res, next) => examConfigController.setAccommodation(req, res, next));

module.exports = router;
