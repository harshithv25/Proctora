const { z } = require('zod');

const ProctorFrameSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid(),
    gazeAway: z.boolean().optional(),
    multipleFaces: z.boolean().optional(),
    noFace: z.boolean().optional(),
    headPoseAngle: z.number().optional(),
    lowLight: z.boolean().optional(),
    rawMetrics: z.record(z.any()).optional()
  })
});

const EditorTelemetrySchema = z.object({
  body: z.object({
    sessionId: z.string().uuid(),
    questionId: z.string().uuid().optional(),
    eventType: z.enum(['KEYSTROKE', 'TEXT_DELTA', 'PASTE', 'RUN', 'SUBMIT']),
    eventData: z.any()
  })
});

const FocusEventSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid(),
    eventType: z.enum(['BLUR', 'FOCUS', 'VISIBILITY_HIDDEN', 'FULLSCREEN_EXIT', 'FULLSCREEN_ENTER'])
  })
});

module.exports = {
  ProctorFrameSchema,
  EditorTelemetrySchema,
  FocusEventSchema
};
