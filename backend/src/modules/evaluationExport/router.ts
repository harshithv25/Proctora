import { Router } from "express";
import * as evalController from "./controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/rbac.middleware";
import { autosaveSchema, submitSchema, candidateQuerySchema, respondQuerySchema } from "./schema";

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
  requireRole("ADMIN", "SUPER_ADMIN"),
  evalController.exportResponses
);

router.get(
  "/:examId/monitor-feed",
  authenticate,
  requireRole("ADMIN", "SUPER_ADMIN"),
  evalController.getMonitorFeed
);

router.get(
  "/:examId/candidates/:userId/sheet",
  authenticate,
  requireRole("ADMIN", "SUPER_ADMIN"),
  evalController.getCandidateAnswerSheet
);

// Candidate in-exam query routes
router.post(
  "/:examId/queries",
  authenticate,
  requireRole("CANDIDATE"),
  validate({ body: candidateQuerySchema }),
  evalController.raiseCandidateQuery
);

router.get(
  "/:examId/queries",
  authenticate,
  requireRole("CANDIDATE"),
  evalController.getCandidateQueries
);

router.get(
  "/:examId/admin/queries",
  authenticate,
  requireRole("ADMIN", "SUPER_ADMIN"),
  evalController.getExamQueriesForAdmin
);

router.patch(
  "/:examId/queries/:queryId",
  authenticate,
  requireRole("ADMIN", "SUPER_ADMIN"),
  validate({ body: respondQuerySchema }),
  evalController.respondCandidateQuery
);

export default router;
