import argon2 from "argon2";
import { prisma } from "../../config/db";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "../../lib/jwt";
import {
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  verifyTotpCode,
} from "../../lib/totp";
import {
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "../../lib/apiError";
import { RegisterInput, LoginInput, AdminCreateInput } from "./schema";
import { env } from "../../config/env";

const MAX_FAILED_ATTEMPTS = 5;

export async function registerCandidate(data: RegisterInput) {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    throw new ConflictError("Email already registered", "AUTH_EMAIL_EXISTS");
  }

  const passwordHash = await argon2.hash(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      rollNumber: data.rollNumber ?? null,
      passwordHash,
      role: "CANDIDATE",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return user;
}

export async function login(
  data: LoginInput,
  userAgent?: string,
  ipAddress?: string
) {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    throw new UnauthorizedError("Invalid credentials", "AUTH_INVALID_CREDENTIALS");
  }

  if (user.isLocked) {
    throw new ForbiddenError(
      "Account is locked due to too many failed attempts",
      "AUTH_ACCOUNT_LOCKED"
    );
  }

  const validPassword = await argon2.verify(user.passwordHash, data.password);

  if (!validPassword) {
    const attempts = user.failedLoginAttempts + 1;
    const isLocked = attempts >= MAX_FAILED_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        isLocked,
      },
    });

    throw new UnauthorizedError("Invalid credentials", "AUTH_INVALID_CREDENTIALS");
  }

  if (user.totpSecret) {
    if (!data.totpCode) {
      throw new UnauthorizedError(
        "2FA code required",
        "AUTH_2FA_REQUIRED"
      );
    }

    const decryptedSecret = decryptTotpSecret(user.totpSecret);
    const valid = verifyTotpCode(decryptedSecret, data.totpCode);

    if (!valid) {
      throw new UnauthorizedError(
        "Invalid 2FA code",
        "AUTH_INVALID_2FA"
      );
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0 },
  });

  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
  });

  const rawRefreshToken = generateRefreshToken();
  const hashedRefreshToken = hashRefreshToken(rawRefreshToken);

  const refreshTTLMs =
    parseInt(env.JWT_REFRESH_TTL) * 24 * 60 * 60 * 1000 || 7 * 24 * 60 * 60 * 1000;

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: hashedRefreshToken,
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
      expiresAt: new Date(Date.now() + refreshTTLMs),
    },
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function refreshSession(oldRefreshToken: string) {
  const hashedToken = hashRefreshToken(oldRefreshToken);

  const session = await prisma.session.findUnique({
    where: { refreshToken: hashedToken },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    throw new UnauthorizedError(
      "Invalid or expired refresh token",
      "AUTH_INVALID_REFRESH"
    );
  }

  await prisma.session.delete({ where: { id: session.id } });

  const accessToken = signAccessToken({
    userId: session.user.id,
    role: session.user.role,
  });

  const newRawRefreshToken = generateRefreshToken();
  const newHashedRefreshToken = hashRefreshToken(newRawRefreshToken);

  const refreshTTLMs =
    parseInt(env.JWT_REFRESH_TTL) * 24 * 60 * 60 * 1000 || 7 * 24 * 60 * 60 * 1000;

  await prisma.session.create({
    data: {
      userId: session.user.id,
      refreshToken: newHashedRefreshToken,
      expiresAt: new Date(Date.now() + refreshTTLMs),
    },
  });

  return {
    accessToken,
    refreshToken: newRawRefreshToken,
  };
}

export async function logout(userId: string, refreshToken?: string) {
  if (refreshToken) {
    const hashedToken = hashRefreshToken(refreshToken);
    await prisma.session.deleteMany({
      where: { userId, refreshToken: hashedToken },
    });
  } else {
    await prisma.session.deleteMany({ where: { userId } });
  }
}

export async function setupTotp(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new NotFoundError("User not found", "USER_NOT_FOUND");
  }

  const { secret, otpauthUrl } = generateTotpSecret();
  const encryptedSecret = encryptTotpSecret(secret);

  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: encryptedSecret },
  });

  return { secret, otpauthUrl };
}

export async function createAdmin(data: AdminCreateInput) {
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    throw new ConflictError("Email already registered", "AUTH_EMAIL_EXISTS");
  }

  const passwordHash = await argon2.hash(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: "ADMIN",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return user;
}
