const { z } = require('zod');

const CreateExamSchema = z.object({
  body: z.object({
    title: z.string().min(3),
    description: z.string().optional(),
    durationMinutes: z.number().positive().default(60),
    idleTimeoutSec: z.number().positive().default(300),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    shufflingMode: z.enum(['RANDOM', 'SEATING']).default('RANDOM')
  })
});

const QuestionUploadSchema = z.object({
  params: z.object({
    examId: z.string().uuid()
  }),
  body: z.object({
    questions: z.array(z.object({
      title: z.string(),
      description: z.string(),
      type: z.enum(['MCQ', 'CODING', 'SHORT_ANSWER']).default('MCQ'),
      options: z.array(z.string()).optional(),
      correctAnswer: z.string().optional(),
      starterCode: z.string().optional(),
      points: z.number().default(1)
    }))
  })
});

const SeatingUploadSchema = z.object({
  params: z.object({
    examId: z.string().uuid()
  }),
  body: z.object({
    seatingPlan: z.array(z.object({
      rollNumber: z.string(),
      seatRow: z.number().int(),
      seatCol: z.number().int(),
      seatLabel: z.string().optional()
    }))
  })
});

const AccommodationSchema = z.object({
  params: z.object({
    examId: z.string().uuid()
  }),
  body: z.object({
    candidateId: z.string().uuid(),
    extraMinutes: z.number().int().min(0).optional(),
    extraTimeSec: z.number().int().min(0).optional(),
    notes: z.string().optional()
  })
});

module.exports = {
  CreateExamSchema,
  QuestionUploadSchema,
  SeatingUploadSchema,
  AccommodationSchema
};
