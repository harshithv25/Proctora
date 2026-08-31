const express = require('express');
const examConfigController = require('./exam-config.controller');
const { authenticateToken, requireAdmin } = require('../../middleware/auth.middleware');

const router = express.Router();

// Public/Candidate view of exams list
router.get('/', authenticateToken, (req, res, next) => examConfigController.getExams(req, res, next));
router.get('/:examId', authenticateToken, (req, res, next) => examConfigController.getExamDetails(req, res, next));

// Admin-only setup routes
router.post('/', authenticateToken, requireAdmin, (req, res, next) => examConfigController.createExam(req, res, next));
router.post('/:examId/questions', authenticateToken, requireAdmin, (req, res, next) => examConfigController.uploadQuestions(req, res, next));
router.post('/:examId/seating', authenticateToken, requireAdmin, (req, res, next) => examConfigController.uploadSeatingPlan(req, res, next));
router.post('/:examId/accommodations', authenticateToken, requireAdmin, (req, res, next) => examConfigController.addAccommodation(req, res, next));

module.exports = router;
