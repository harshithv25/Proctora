import { Router } from "express";
import * as superAdminController from "./controller";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/rbac.middleware";

const router = Router();

router.get(
  "/logs",
  authenticate,
  requireRole("SUPER_ADMIN", "ADMIN"),
  superAdminController.listLogs
);

export default router;
