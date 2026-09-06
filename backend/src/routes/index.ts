import { Router, Request, Response } from "express";
import authRouter from "../modules/auth/router";
import examConfigRouter from "../modules/examConfig/router";
import examDeliveryRouter from "../modules/examDelivery/router";
import integrityRouter from "../modules/integrityMonitoring/router";
import evaluationRouter from "../modules/evaluationExport/router";
import { generateToken } from "../middleware/csrf.middleware";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

router.get("/csrf-token", (req: Request, res: Response) => {
  const token = generateToken(req, res);
  res.json({ data: { csrfToken: token } });
});

router.use("/auth", authRouter);
router.use("/exams", examConfigRouter);
router.use("/exams", examDeliveryRouter);
router.use("/exams", integrityRouter);
router.use("/exams", evaluationRouter);

export default router;
