import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  rollNumber: z.string().min(1, "Roll number is required").max(20).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  totpCode: z.string().length(6).optional(),
});

export const totpSetupSchema = z.object({});

export const totpVerifySchema = z.object({
  code: z.string().length(6, "TOTP code must be 6 digits"),
});

export const adminCreateSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

export const forgotPasswordVerifySchema = z.object({
  email: z.string().email("Invalid email address"),
  totpCode: z.string().length(6, "TOTP code must be exactly 6 digits"),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TotpVerifyInput = z.infer<typeof totpVerifySchema>;
export type AdminCreateInput = z.infer<typeof adminCreateSchema>;
export type ForgotPasswordVerifyInput = z.infer<typeof forgotPasswordVerifySchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

