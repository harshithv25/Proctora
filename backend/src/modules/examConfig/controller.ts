import { Request, Response, NextFunction } from "express";
import * as examConfigService from "./service";

export async function listExams(_req: Request, res: Response, next: NextFunction) {
  try {
    const exams = await examConfigService.listExams();
    res.json({ data: { exams } });
  } catch (err) {
    next(err);
  }
}

export async function getExam(req: Request, res: Response, next: NextFunction) {
  try {
    const exam = await examConfigService.getExamByIdOrTestId(req.params.examId as string);
    res.json({ data: { exam } });
  } catch (err) {
    next(err);
  }
}

export async function createExam(req: Request, res: Response, next: NextFunction) {
  try {
    const exam = await examConfigService.createExam({
      ...req.body,
      createdBy: req.user!.userId,
    });
    res.status(201).json({ data: { exam } });
  } catch (err) {
    next(err);
  }
}

export async function updateExam(req: Request, res: Response, next: NextFunction) {
  try {
    const exam = await examConfigService.updateExam(req.params.examId as string, req.body);
    res.json({ data: { exam } });
  } catch (err) {
    next(err);
  }
}

export async function saveQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const questions = await examConfigService.saveQuestions(
      req.params.examId as string,
      req.body.questions
    );
    res.status(200).json({ data: { count: questions.length, questions } });
  } catch (err) {
    next(err);
  }
}

export async function uploadSeatingCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await examConfigService.processSeatingCsv(
      req.params.examId as string,
      req.body.csvContent,
      req.body.hasHeader ?? false
    );
    res.status(200).json({ data: result });
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
    res.status(201).json({ data: { accommodation } });
  } catch (err) {
    next(err);
  }
}

export async function deleteExam(req: Request, res: Response, next: NextFunction) {
  try {
    await examConfigService.deleteExam(req.params.examId as string);
    res.json({ data: { message: "Examination deleted successfully" } });
  } catch (err) {
    next(err);
  }
}
