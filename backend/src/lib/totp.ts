import { generateSecret, generateURI, verifySync } from "otplib";
import { encrypt, decrypt } from "./crypto";
import { env } from "../config/env";

export function generateTotpSecret(): { secret: string; otpauthUrl: string } {
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: env.TOTP_ISSUER,
    label: "user",
    secret,
  });
  return { secret, otpauthUrl };
}

export function encryptTotpSecret(secret: string): string {
  return encrypt(secret);
}

export function decryptTotpSecret(encrypted: string): string {
  return decrypt(encrypted);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const result = verifySync({
    secret,
    token: code,
    epochTolerance: 30,
  });
  return result.valid;
}
