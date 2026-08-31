const { z } = require('zod');

const DeviceCheckSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid(),
    browserInfo: z.string().optional(),
    webcamPassed: z.boolean().default(true),
    micPassed: z.boolean().default(true),
    bandwidthPassed: z.boolean().default(true),
    remediationNotes: z.string().optional()
  })
});

const StartSessionSchema = z.object({
  body: z.object({
    examId: z.string().uuid()
  })
});

const LaunchExamSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid()
  })
});

module.exports = {
  DeviceCheckSchema,
  StartSessionSchema,
  LaunchExamSchema
};
