import { Router } from "express";
import * as examConfigController from "./controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/rbac.middleware";
import {
  createExamSchema,
  updateExamSchema,
  addQuestionsSchema,
  uploadCsvSeatingSchema,
  accommodationSchema,
} from "./schema";

const router = Router();

router.get(
  "/",
  authenticate,
  requireRole("ADMIN"),
  examConfigController.listExams
);

router.get(
  "/:examId",
  authenticate,
  requireRole("ADMIN"),
  examConfigController.getExam
);

router.post(
  "/",
  authenticate,
  requireRole("ADMIN"),
  validate({ body: createExamSchema }),
  examConfigController.createExam
);

router.put(
  "/:examId",
  authenticate,
  requireRole("ADMIN"),
  validate({ body: updateExamSchema }),
  examConfigController.updateExam
);

router.post(
  "/:examId/questions",
  authenticate,
  requireRole("ADMIN"),
  validate({ body: addQuestionsSchema }),
  examConfigController.saveQuestions
);

router.put(
  "/:examId/questions",
  authenticate,
  requireRole("ADMIN"),
  validate({ body: addQuestionsSchema }),
  examConfigController.saveQuestions
);

router.post(
  "/:examId/seating-plan/csv",
  authenticate,
  requireRole("ADMIN"),
  validate({ body: uploadCsvSeatingSchema }),
  examConfigController.uploadSeatingCsv
);

router.post(
  "/:examId/accommodations",
  authenticate,
  requireRole("ADMIN"),
  validate({ body: accommodationSchema }),
  examConfigController.grantAccommodation
);

router.delete(
  "/:examId",
  authenticate,
  requireRole("ADMIN"),
  examConfigController.deleteExam
);

export default router;
