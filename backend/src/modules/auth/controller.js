const authService = require('./service');
const { prisma } = require('../../config/db');
const { AppError } = require('../../lib/apiError');
const { generateCsrfToken } = require('../../middleware/csrf.middleware');

class AuthController {
    async register(req, res, next) {
        try {
            const { email, password, name, rollNumber } = req.body;
            const result = await authService.registerCandidate({ email, password, name, rollNumber });

            res.status(201).json({
                message: 'Registration successful. Please setup 2FA.',
                user: result
            });
        } catch (err) {
            next(err);
        }
    }

    async setup2FA(req, res, next) {
        try {
            const userId = req.body.userId || req.user?.id;
            if (!userId) {
                throw new AppError(400, 'VALIDATION_ERROR', 'userId is required for 2FA setup.');
            }

            const result = await authService.setup2FA(userId);
            res.status(200).json({
                message: '2FA setup initiated successfully.',
                ...result
            });
        } catch (err) {
            next(err);
        }
    }

    async createAdmin(req, res, next) {
        try {
            const { email, password, name } = req.body;
            const result = await authService.createAdminByAdmin({ email, password, name });

            res.status(201).json({
                message: 'Admin account created successfully.',
                admin: result
            });
        } catch (err) {
            next(err);
        }
    }

    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const user = await authService.validateCredentials(email, password);

            res.status(200).json({
                message: 'Credentials valid. 2FA code required.',
                userId: user.id,
                email: user.email,
                twoFactorEnabled: user.twoFactorEnabled
            });
        } catch (err) {
            next(err);
        }
    }

    async verify2FA(req, res, next) {
        try {
            const { userId, token } = req.body;
            const userAgent = req.headers['user-agent'] || 'Unknown';
            const ipAddress = req.ip || req.connection.remoteAddress;

            const authResult = await authService.verify2FAAndLogin(userId, token, userAgent, ipAddress);
            const csrfToken = generateCsrfToken();

            res.cookie('accessToken', authResult.accessToken, {
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 15 * 60 * 1000
            });

            res.cookie('refreshToken', authResult.refreshToken, {
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 7 * 24 * 3600 * 1000
            });

            res.cookie('csrfToken', csrfToken, {
                httpOnly: false,
                sameSite: 'lax',
                maxAge: 7 * 24 * 3600 * 1000
            });

            res.status(200).json({
                message: '2FA authentication successful.',
                user: authResult.user,
                accessToken: authResult.accessToken,
                refreshToken: authResult.refreshToken,
                csrfToken
            });
        } catch (err) {
            next(err);
        }
    }

    async refreshToken(req, res, next) {
        try {
            const tokenFromCookie = req.cookies ? req.cookies.refreshToken : null;
            const tokenFromBody = req.body ? req.body.refreshToken : null;
            const refreshToken = tokenFromCookie || tokenFromBody;

            const result = await authService.refreshTokens(refreshToken);
            const csrfToken = generateCsrfToken();

            res.cookie('accessToken', result.accessToken, {
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 15 * 60 * 1000
            });

            res.cookie('refreshToken', result.refreshToken, {
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 7 * 24 * 3600 * 1000
            });

            res.cookie('csrfToken', csrfToken, {
                httpOnly: false,
                sameSite: 'lax',
                maxAge: 7 * 24 * 3600 * 1000
            });

            res.status(200).json({
                message: 'Token rotated successfully',
                ...result,
                csrfToken
            });
        } catch (err) {
            next(err);
        }
    }

    async logout(req, res, next) {
        try {
            const tokenFromCookie = req.cookies ? req.cookies.refreshToken : null;
            const tokenFromBody = req.body ? req.body.refreshToken : null;
            const refreshToken = tokenFromCookie || tokenFromBody;

            await authService.logoutSession(refreshToken);

            res.clearCookie('accessToken');
            res.clearCookie('refreshToken');
            res.clearCookie('csrfToken');

            res.status(200).json({ message: 'Logged out successfully.' });
        } catch (err) {
            next(err);
        }
    }

    async getProfile(req, res, next) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    rollNumber: true,
                    role: true,
                    twoFactorEnabled: true,
                    isLocked: true,
                    createdAt: true
                }
            });

            if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User profile not found');

            res.status(200).json({ user });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new AuthController();
