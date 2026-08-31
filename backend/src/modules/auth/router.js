const express = require('express');
const authController = require('./controller');
const { authenticateToken } = require('../../middleware/auth.middleware');
const { requireAdmin } = require('../../middleware/rbac.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { RegisterSchema, Setup2FASchema, CreateAdminSchema, LoginSchema, Verify2FASchema } = require('./schema');

const router = express.Router();

router.post('/register', validate(RegisterSchema), (req, res, next) => authController.register(req, res, next));
router.post('/2fa/setup', validate(Setup2FASchema), (req, res, next) => authController.setup2FA(req, res, next));
router.post('/admin/create', authenticateToken, requireAdmin, validate(CreateAdminSchema), (req, res, next) => authController.createAdmin(req, res, next));
router.post('/login', validate(LoginSchema), (req, res, next) => authController.login(req, res, next));
router.post('/2fa/verify', validate(Verify2FASchema), (req, res, next) => authController.verify2FA(req, res, next));
router.post('/refresh', (req, res, next) => authController.refreshToken(req, res, next));
router.post('/logout', authenticateToken, (req, res, next) => authController.logout(req, res, next));
router.get('/me', authenticateToken, (req, res, next) => authController.getProfile(req, res, next));

module.exports = router;
