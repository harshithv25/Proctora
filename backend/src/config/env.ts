import dotenv from "dotenv";
dotenv.config();

import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  AES_ENCRYPTION_KEY: z.string().length(64),
  CSRF_SECRET: z.string().min(32),

  TOTP_ISSUER: z.string().default("NITK-OnlineExam"),

  CLIENT_URL: z.string().url().default("http://localhost:5173"),
});

export const env = EnvSchema.parse(process.env);
