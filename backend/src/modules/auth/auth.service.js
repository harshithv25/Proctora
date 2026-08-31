const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateSecret, verify } = require('otplib');
const prisma = require('../../lib/prisma');
const { JWT_SECRET } = require('../../middleware/auth.middleware');

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
            throw new Error('A user with this email or roll number already exists.');
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const twoFactorSecret = generateSecret();

        const newUser = await prisma.user.create({
            data: {
                email,
                name,
                rollNumber: rollNumber || null,
                passwordHash,
                role: 'STUDENT',
                twoFactorSecret,
                twoFactorEnabled: false
            }
        });

        return {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            rollNumber: newUser.rollNumber,
            role: newUser.role,
            twoFactorSecret: newUser.twoFactorSecret,
            twoFactorOtpAuthUrl: `otpauth://totp/Proctora:${encodeURIComponent(newUser.email)}?secret=${newUser.twoFactorSecret}&issuer=Proctora`
        };
    }

    async registerAdmin(data) {
        const { email, password, name } = data;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new Error('An administrator account with this email already exists.');
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const twoFactorSecret = generateSecret();

        const newAdmin = await prisma.user.create({
            data: {
                email,
                name,
                passwordHash,
                role: 'ADMIN',
                twoFactorSecret,
                twoFactorEnabled: false
            }
        });

        return {
            id: newAdmin.id,
            email: newAdmin.email,
            name: newAdmin.name,
            role: newAdmin.role,
            twoFactorSecret: newAdmin.twoFactorSecret,
            twoFactorOtpAuthUrl: `otpauth://totp/Proctora-Admin:${encodeURIComponent(newAdmin.email)}?secret=${newAdmin.twoFactorSecret}&issuer=Proctora`
        };
    }

    async validateCredentials(email, password) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        return user;
    }

    async verify2FAAndLogin(userId, token) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }

        // For development/testing ease, allow "123456" as universal test TOTP or verify actual TOTP
        let isValid2FA = false;
        try {
            if (token === '123456' || (user.twoFactorSecret && verify({ token, secret: user.twoFactorSecret }))) {
                isValid2FA = true;
            }
        } catch (e) {
            if (token === '123456') isValid2FA = true;
        }

        if (!isValid2FA) {
            throw new Error('Invalid 2FA code');
        }

        if (!user.twoFactorEnabled) {
            await prisma.user.update({
                where: { id: userId },
                data: { twoFactorEnabled: true }
            });
        }

        const sessionToken = jwt.sign(
            { id: user.id, email: user.email, name: user.name, rollNumber: user.rollNumber, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                rollNumber: user.rollNumber,
                role: user.role
            },
            token: sessionToken
        };
    }
}

module.exports = new AuthService();
