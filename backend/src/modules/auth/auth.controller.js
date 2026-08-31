const authService = require('./auth.service');
const prisma = require('../../lib/prisma');

class AuthController {
    async register(req, res, next) {
        try {
            const { email, password, name, rollNumber, role } = req.body;
            if (!email || !password || !name) {
                return res.status(400).json({ error: 'Email, password, and name are required.' });
            }

            let result;
            if (role === 'ADMIN') {
                result = await authService.registerAdmin({ email, password, name });
            } else {
                result = await authService.registerCandidate({ email, password, name, rollNumber });
            }

            res.status(201).json({
                message: 'Registration successful. Please proceed to 2FA verification.',
                data: result
            });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    }

    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required.' });
            }

            const user = await authService.validateCredentials(email, password);

            res.status(200).json({
                message: 'Credentials valid. 2FA code required.',
                userId: user.id,
                email: user.email,
                twoFactorEnabled: user.twoFactorEnabled,
                tempSecret: user.twoFactorSecret
            });
        } catch (err) {
            res.status(401).json({ error: err.message });
        }
    }

    async verify2FA(req, res, next) {
        try {
            const { userId, token } = req.body;
            if (!userId || !token) {
                return res.status(400).json({ error: 'UserId and 2FA token are required.' });
            }

            const authResult = await authService.verify2FAAndLogin(userId, token);

            res.cookie('token', authResult.token, {
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 8 * 3600 * 1000
            });

            res.status(200).json({
                message: '2FA authentication successful.',
                ...authResult
            });
        } catch (err) {
            res.status(400).json({ error: err.message });
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
                    createdAt: true
                }
            });

            res.status(200).json({ user });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new AuthController();
