import { Request, Response, NextFunction } from "express";
import * as examDeliveryService from "./service";

export async function deviceCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await examDeliveryService.deviceCheck(
      req.params.examId as string,
      req.body
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const questions = await examDeliveryService.getQuestions(req.params.examId as string);
    res.json({ data: questions });
  } catch (err) {
    next(err);
  }
}

export async function fullscreenEvent(req: Request, res: Response, next: NextFunction) {
  try {
    await examDeliveryService.logFullscreenEvent(
      req.params.examId as string,
      req.user!.userId,
      req.body.eventType
    );
    res.json({ data: { message: "Event logged" } });
  } catch (err) {
    next(err);
  }
}

export async function getSessionConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const config = await examDeliveryService.getSessionConfig(
      req.params.examId as string,
      req.user!.userId
    );
    res.json({ data: config });
  } catch (err) {
    next(err);
  }
}
