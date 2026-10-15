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

export async function getMonitorFeed(req: Request, res: Response, next: NextFunction) {
  try {
    const feed = await evalService.getExamMonitorFeed(req.params.examId as string);
    res.json({ data: feed });
  } catch (err) {
    next(err);
  }
}

export async function getCandidateAnswerSheet(req: Request, res: Response, next: NextFunction) {
  try {
    const sheet = await evalService.getCandidateAnswerSheet(
      req.params.examId as string,
      req.params.userId as string
    );
    res.json({ data: sheet });
  } catch (err) {
    next(err);
  }
}

export async function raiseCandidateQuery(req: Request, res: Response, next: NextFunction) {
  try {
    const { query, category, questionId } = req.body;
    const result = await evalService.raiseCandidateQuery(
      req.params.examId as string,
      req.user!.userId,
      query,
      category,
      questionId
    );
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getCandidateQueries(req: Request, res: Response, next: NextFunction) {
  try {
    const queries = await evalService.getCandidateQueries(
      req.params.examId as string,
      req.user!.userId
    );
    res.json({ data: queries });
  } catch (err) {
    next(err);
  }
}

export async function getExamQueriesForAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const queries = await evalService.getExamQueriesForAdmin(req.params.examId as string);
    res.json({ data: queries });
  } catch (err) {
    next(err);
  }
}

export async function respondCandidateQuery(req: Request, res: Response, next: NextFunction) {
  try {
    const { response, status } = req.body;
    const result = await evalService.respondCandidateQuery(
      req.params.queryId as string,
      req.user!.userId,
      response,
      status
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}
