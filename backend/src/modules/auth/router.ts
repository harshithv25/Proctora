import { Router } from "express";
import * as authController from "./controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/rbac.middleware";
import { authLimiter, strictLimiter } from "../../middleware/rateLimit.middleware";
import {
  registerSchema,
  loginSchema,
  adminCreateSchema,
  forgotPasswordVerifySchema,
  resetPasswordSchema,
} from "./schema";

const router = Router();

router.post(
  "/register",
  authLimiter,
  validate({ body: registerSchema }),
  authController.register
);

router.post(
  "/login",
  authLimiter,
  validate({ body: loginSchema }),
  authController.login
);

router.post("/refresh", authController.refresh);

router.post("/logout", authenticate, authController.logout);

router.post(
  "/2fa/setup",
  authenticate,
  strictLimiter,
  authController.setupTotp
);

router.post(
  "/2fa/confirm",
  authenticate,
  strictLimiter,
  authController.confirmTotp
);

router.post(
  "/forgot-password/verify-2fa",
  strictLimiter,
  validate({ body: forgotPasswordVerifySchema }),
  authController.verify2FaForReset
);

router.post(
  "/reset-password",
  strictLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword
);

router.post(
  "/admin/create",
  authenticate,
  requireRole("ADMIN"),
  validate({ body: adminCreateSchema }),
  authController.createAdmin
);

export default router;

