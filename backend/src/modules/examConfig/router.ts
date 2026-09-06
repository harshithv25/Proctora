import { Router } from "express";
import * as examConfigController from "./controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/rbac.middleware";
import {
  createExamSchema,
  addQuestionsSchema,
  seatingPlanSchema,
  accommodationSchema,
} from "./schema";

const router = Router();

router.post(
  "/",
  authenticate,
  requireRole("ADMIN"),
  validate({ body: createExamSchema }),
  examConfigController.createExam
);

router.post(
  "/:examId/questions",
  authenticate,
  requireRole("ADMIN"),
  validate({ body: addQuestionsSchema }),
  examConfigController.addQuestions
);

router.post(
  "/:examId/seating-plan",
  authenticate,
  requireRole("ADMIN"),
  validate({ body: seatingPlanSchema }),
  examConfigController.setSeatingPlan
);

router.post(
  "/:examId/accommodations",
  authenticate,
  requireRole("ADMIN"),
  validate({ body: accommodationSchema }),
  examConfigController.grantAccommodation
);

export default router;
