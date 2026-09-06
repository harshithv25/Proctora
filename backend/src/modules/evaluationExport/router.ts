import { Router } from "express";
import * as evalController from "./controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/rbac.middleware";
import { autosaveSchema, submitSchema } from "./schema";

const router = Router();

router.post(
  "/:examId/responses/autosave",
  authenticate,
  requireRole("CANDIDATE"),
  validate({ body: autosaveSchema }),
  evalController.autosave
);

router.post(
  "/:examId/responses/submit",
  authenticate,
  requireRole("CANDIDATE"),
  validate({ body: submitSchema }),
  evalController.submit
);

router.get(
  "/:examId/export",
  authenticate,
  requireRole("ADMIN"),
  evalController.exportResponses
);

export default router;
