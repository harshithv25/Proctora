import { z } from "zod";

export const createExamSchema = z.object({
  title: z.string().min(1).max(200),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  idleTimeoutSec: z.number().int().min(60).default(300),
});

export const addQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      content: z.string().min(1),
      type: z.enum(["mcq", "code"]),
      metadata: z.any().optional(),
    })
  ),
});

export const seatingPlanSchema = z.object({
  assignments: z.array(
    z.object({
      rollNumber: z.string().min(1),
      seatRow: z.number().int().min(0),
      seatCol: z.number().int().min(0),
      questionSetId: z.string().optional(),
    })
  ),
});

export const accommodationSchema = z.object({
  userId: z.string().uuid(),
  extraTimeSec: z.number().int().min(0),
});
