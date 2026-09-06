import { Request, Response, NextFunction } from "express";
import * as integrityService from "./service";

export async function proctoringFrame(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await integrityService.recordProctoringFrame(
      req.params.examId as string,
      req.user!.userId,
      req.body
    );
    res.status(201).json({ data: event });
  } catch (err) {
    next(err);
  }
}

export async function editorTelemetry(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await integrityService.recordEditorTelemetry(
      req.params.examId as string,
      req.user!.userId,
      req.body
    );
    res.status(201).json({ data: event });
  } catch (err) {
    next(err);
  }
}

export async function focusEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await integrityService.recordFocusEvent(
      req.params.examId as string,
      req.user!.userId,
      req.body.eventType
    );
    res.status(201).json({ data: event });
  } catch (err) {
    next(err);
  }
}

export async function proctoringAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const alerts = await integrityService.getProctoringAlerts(req.params.examId as string);
    res.json({ data: alerts });
  } catch (err) {
    next(err);
  }
}

export async function autoLogout(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await integrityService.triggerAutoLogout(
      req.params.examId as string,
      req.params.userId as string,
      req.body.reason ?? "idle_timeout"
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
