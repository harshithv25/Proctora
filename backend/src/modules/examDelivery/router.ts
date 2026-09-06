import { Router } from "express";
import * as examDeliveryController from "./controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/rbac.middleware";
import { deviceCheckSchema, fullscreenEventSchema } from "./schema";

const router = Router();

router.post(
  "/:examId/device-check",
  authenticate,
  requireRole("CANDIDATE"),
  validate({ body: deviceCheckSchema }),
  examDeliveryController.deviceCheck
);

router.get(
  "/:examId/questions",
  authenticate,
  requireRole("CANDIDATE"),
  examDeliveryController.getQuestions
);

router.post(
  "/:examId/fullscreen-event",
  authenticate,
  requireRole("CANDIDATE"),
  validate({ body: fullscreenEventSchema }),
  examDeliveryController.fullscreenEvent
);

router.get(
  "/:examId/session-config",
  authenticate,
  requireRole("CANDIDATE"),
  examDeliveryController.getSessionConfig
);

export default router;
