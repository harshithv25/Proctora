const argon2 = require('argon2');
const { prisma } = require('../../config/db');
const { encrypt, decrypt } = require('../../lib/crypto');
const { signAccessToken, generateRawRefreshToken, hashRefreshToken } = require('../../lib/jwt');
const { generateTotpSecret, verifyTotpCode } = require('../../lib/totp');
const { env } = require('../../config/env');
const { AppError } = require('../../lib/apiError');

class AuthService {
    async registerCandidate(data) {
        const { email, password, name, rollNumber } = data;

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { rollNumber: rollNumber || undefined }
                ]
            }
        });

        if (existingUser) {
            throw new AppError(400, 'AUTH_USER_EXISTS', 'A user with this email or roll number already exists.');
        }

        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

        const newUser = await prisma.user.create({
            data: {
                email,
                name,
                rollNumber: rollNumber || null,
                passwordHash,
                role: 'CANDIDATE',
                twoFactorEnabled: false
            }
        });

        return {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            rollNumber: newUser.rollNumber,
            role: newUser.role
        };
    }

    async setup2FA(userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new AppError(404, 'AUTH_USER_NOT_FOUND', 'User not found');
        }

        const rawTotpSecret = generateTotpSecret();
        const encryptedTotpSecret = encrypt(rawTotpSecret);

        await prisma.user.update({
            where: { id: userId },
            data: { totpSecret: encryptedTotpSecret }
        });

        const issuerLabel = user.role === 'ADMIN' ? `${env.TOTP_ISSUER}-Admin` : env.TOTP_ISSUER;
        const totpOtpAuthUrl = `otpauth://totp/${encodeURIComponent(issuerLabel)}:${encodeURIComponent(user.email)}?secret=${rawTotpSecret}&issuer=${encodeURIComponent(issuerLabel)}`;

        return {
            totpSecretRaw: rawTotpSecret,
            totpOtpAuthUrl
        };
    }

    async createAdminByAdmin(adminData) {
        const { email, password, name } = adminData;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new AppError(400, 'AUTH_ADMIN_EXISTS', 'An administrator account with this email already exists.');
        }

        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

        const newAdmin = await prisma.user.create({
            data: {
                email,
                name,
                passwordHash,
                role: 'ADMIN',
                twoFactorEnabled: false
            }
        });

        return {
            id: newAdmin.id,
            email: newAdmin.email,
            name: newAdmin.name,
            role: newAdmin.role
        };
    }

    async validateCredentials(email, password) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new AppError(401, 'AUTH_CREDENTIALS_INVALID', 'Invalid credentials');
        }

        if (user.isLocked) {
            throw new AppError(403, 'AUTH_ACCOUNT_LOCKED', 'Account is locked due to repeated failed login attempts.');
        }

        const isValid = await argon2.verify(user.passwordHash, password);
        if (!isValid) {
            const attempts = user.failedLoginAttempts + 1;
            const isLockedNow = attempts >= 5;

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: attempts,
                    isLocked: isLockedNow
                }
            });

            if (isLockedNow) {
                throw new AppError(403, 'AUTH_ACCOUNT_LOCKED', 'Account is locked due to repeated failed login attempts.');
            }

            throw new AppError(401, 'AUTH_CREDENTIALS_INVALID', 'Invalid credentials');
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0 }
        });

        return user;
    }

    async verify2FAAndLogin(userId, token, userAgent = null, ipAddress = null) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new AppError(404, 'AUTH_USER_NOT_FOUND', 'User not found');
        }

        if (user.isLocked) {
            throw new AppError(403, 'AUTH_ACCOUNT_LOCKED', 'Account is locked due to repeated failed login attempts.');
        }

        const rawSecret = user.totpSecret ? decrypt(user.totpSecret) : null;
        const isValid2FA = verifyTotpCode(token, rawSecret);

        if (!isValid2FA) {
            const attempts = user.failedLoginAttempts + 1;
            const isLockedNow = attempts >= 5;

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: attempts,
                    isLocked: isLockedNow
                }
            });

            throw new AppError(401, 'AUTH_INVALID_2FA', 'Invalid 2FA code provided.');
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                failedLoginAttempts: 0,
                twoFactorEnabled: true
            }
        });

        const accessToken = signAccessToken({
            id: user.id,
            email: user.email,
            name: user.name,
            rollNumber: user.rollNumber,
            role: user.role
        });

        const rawRefreshToken = generateRawRefreshToken();
        const hashedToken = hashRefreshToken(rawRefreshToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

        await prisma.session.create({
            data: {
                userId: user.id,
                refreshToken: hashedToken,
                userAgent,
                ipAddress,
                expiresAt
            }
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                rollNumber: user.rollNumber,
                role: user.role
            },
            accessToken,
            refreshToken: rawRefreshToken
        };
    }

    async refreshTokens(rawRefreshToken) {
        if (!rawRefreshToken) {
            throw new AppError(401, 'AUTH_REFRESH_TOKEN_REQUIRED', 'Refresh token required.');
        }

        const hashedToken = hashRefreshToken(rawRefreshToken);

        const session = await prisma.session.findUnique({
            where: { refreshToken: hashedToken },
            include: { user: true }
        });

        if (!session || session.expiresAt < new Date()) {
            if (session) await prisma.session.delete({ where: { id: session.id } });
            throw new AppError(403, 'AUTH_REFRESH_TOKEN_INVALID', 'Invalid or expired refresh token.');
        }

        await prisma.session.delete({ where: { id: session.id } });

        const newRawRefreshToken = generateRawRefreshToken();
        const newHashedToken = hashRefreshToken(newRawRefreshToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

        await prisma.session.create({
            data: {
                userId: session.user.id,
                refreshToken: newHashedToken,
                userAgent: session.userAgent,
                ipAddress: session.ipAddress,
                expiresAt
            }
        });

        const newAccessToken = signAccessToken({
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            rollNumber: session.user.rollNumber,
            role: session.user.role
        });

        return {
            accessToken: newAccessToken,
            refreshToken: newRawRefreshToken
        };
    }

    async logoutSession(rawRefreshToken) {
        if (!rawRefreshToken) return;
        const hashedToken = hashRefreshToken(rawRefreshToken);
        await prisma.session.deleteMany({
            where: { refreshToken: hashedToken }
        });
    }
}

module.exports = new AuthService();
