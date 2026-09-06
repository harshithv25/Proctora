import { Request, Response, NextFunction } from "express";
import * as evalService from "./service";

export async function autosave(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await evalService.autosave(
      req.params.examId as string,
      req.user!.userId,
      req.body.answers
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function submit(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await evalService.submit(
      req.params.examId as string,
      req.user!.userId,
      req.body.answers,
      req.body.submittedVia
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function exportResponses(req: Request, res: Response, next: NextFunction) {
  try {
    const responses = await evalService.exportResponses(req.params.examId as string);
    res.json({ data: responses });
  } catch (err) {
    next(err);
  }
}
