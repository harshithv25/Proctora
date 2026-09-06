import { Router } from "express";
import * as integrityController from "./controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/rbac.middleware";
import {
  proctoringFrameSchema,
  editorTelemetrySchema,
  focusEventSchema,
  autoLogoutSchema,
} from "./schema";

const router = Router();

router.post(
  "/:examId/proctoring/frame",
  authenticate,
  requireRole("CANDIDATE"),
  validate({ body: proctoringFrameSchema }),
  integrityController.proctoringFrame
);

router.post(
  "/:examId/telemetry/editor",
  authenticate,
  requireRole("CANDIDATE"),
  validate({ body: editorTelemetrySchema }),
  integrityController.editorTelemetry
);

router.post(
  "/:examId/focus-event",
  authenticate,
  requireRole("CANDIDATE"),
  validate({ body: focusEventSchema }),
  integrityController.focusEvent
);

router.get(
  "/:examId/proctoring/alerts",
  authenticate,
  requireRole("ADMIN"),
  integrityController.proctoringAlerts
);

router.post(
  "/:examId/sessions/:userId/auto-logout",
  authenticate,
  validate({ body: autoLogoutSchema }),
  integrityController.autoLogout
);

export default router;
