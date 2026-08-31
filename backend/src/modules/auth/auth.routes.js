const express = require('express');
const authController = require('./auth.controller');
const { authenticateToken } = require('../../middleware/auth.middleware');

const router = express.Router();

router.post('/register', (req, res, next) => authController.register(req, res, next));
router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/verify-2fa', (req, res, next) => authController.verify2FA(req, res, next));
router.get('/me', authenticateToken, (req, res, next) => authController.getProfile(req, res, next));

module.exports = router;
