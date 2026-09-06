import { Request, Response, NextFunction } from "express";
import * as examConfigService from "./service";

export async function createExam(req: Request, res: Response, next: NextFunction) {
  try {
    const exam = await examConfigService.createExam({
      ...req.body,
      createdBy: req.user!.userId,
    });
    res.status(201).json({ data: exam });
  } catch (err) {
    next(err);
  }
}

export async function addQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await examConfigService.addQuestions(
      req.params.examId as string,
      req.body.questions
    );
    res.status(201).json({ data: { count: result.count } });
  } catch (err) {
    next(err);
  }
}

export async function setSeatingPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await examConfigService.setSeatingPlan(
      req.params.examId as string,
      req.body.assignments
    );
    res.status(201).json({ data: { count: result.count } });
  } catch (err) {
    next(err);
  }
}

export async function grantAccommodation(req: Request, res: Response, next: NextFunction) {
  try {
    const accommodation = await examConfigService.grantAccommodation(
      req.params.examId as string,
      req.body.userId,
      req.body.extraTimeSec,
      req.user!.userId
    );
    res.status(201).json({ data: accommodation });
  } catch (err) {
    next(err);
  }
}
