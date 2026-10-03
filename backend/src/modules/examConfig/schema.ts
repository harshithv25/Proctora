import { z } from "zod";

export const createExamSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  testId: z
    .string()
    .min(3, "Test ID must be at least 3 characters")
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, "Test ID can only contain letters, numbers, underscores, and dashes")
    .optional(),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  maxStudents: z.number().int().min(1).optional(),
  duration: z.number().int().min(1).max(1440).default(60), // in minutes
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  idleTimeoutSec: z.number().int().min(30).max(3600).default(300),
});

export const updateExamSchema = createExamSchema.partial();

export const questionItemSchema = z.object({
  id: z.string().optional(),
  content: z.string().min(1, "Question statement cannot be empty"),
  type: z.enum(["descriptive", "coding", "mcq", "multi_correct"]),
  order: z.number().int().min(0).optional(),
  metadata: z
    .object({
      options: z.array(z.string()).optional(),
      correctAnswer: z.string().optional(),
      correctAnswers: z.array(z.string()).optional(),
      language: z.enum(["c", "js", "python", "cpp", "java"]).optional(),
      starterCode: z.string().optional(),
      solutionCode: z.string().optional(),
      sampleAnswer: z.string().optional(),
      rubric: z.string().optional(),
      testCases: z.any().optional(),
    })
    .passthrough()
    .optional(),
});

export const addQuestionsSchema = z.object({
  questions: z.array(questionItemSchema),
});

export const uploadCsvSeatingSchema = z.object({
  csvContent: z.string().min(1, "CSV content cannot be empty"),
  hasHeader: z.boolean().default(false),
});

export const seatingPlanSchema = z.object({
  assignments: z.array(
    z.object({
      rollNumber: z.string().min(1),
      seatRow: z.number().int().min(0),
      seatCol: z.number().int().min(0),
      questionSetId: z.string().optional(),
      questionOrder: z.array(z.string()).optional(),
    })
  ),
  csvContent: z.string().optional(),
  grid: z.array(z.array(z.string())).optional(),
});

export const accommodationSchema = z.object({
  userId: z.string().uuid(),
  extraTimeSec: z.number().int().min(0),
});
