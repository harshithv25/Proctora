const { z } = require('zod');

const AutosaveSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid(),
    questionId: z.string().uuid(),
    answerText: z.string().optional(),
    codeSubmission: z.string().optional()
  })
});

const FinalizeSubmitSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid(),
    responses: z.array(z.object({
      questionId: z.string().uuid(),
      answerText: z.string().optional(),
      codeSubmission: z.string().optional()
    })).optional()
  })
});

module.exports = {
  AutosaveSchema,
  FinalizeSubmitSchema
};
