const { z } = require('zod');

const RegisterSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(2),
    rollNumber: z.string().optional()
  })
});

const Setup2FASchema = z.object({
  body: z.object({
    userId: z.string().uuid('Valid userId is required').optional()
  })
});

const CreateAdminSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(2)
  })
});

const LoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1, 'Password is required')
  })
});

const Verify2FASchema = z.object({
  body: z.object({
    userId: z.string().uuid('Valid userId is required'),
    token: z.string().min(6, '2FA token must be 6 digits')
  })
});

module.exports = {
  RegisterSchema,
  Setup2FASchema,
  CreateAdminSchema,
  LoginSchema,
  Verify2FASchema
};
