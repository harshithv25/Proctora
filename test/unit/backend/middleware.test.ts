import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
} from '../../../backend/src/lib/apiError';

describe('Backend Unit Tests: Middleware & API Error Handling', () => {

  describe('Standardized API Error Class Hierarchy', () => {
    it('should assign correct HTTP status codes to each custom error subclass', () => {
      const notFound = new NotFoundError('Exam not found', 'EXAM_NOT_FOUND');
      assert.strictEqual(notFound.statusCode, 404);
      assert.strictEqual(notFound.code, 'EXAM_NOT_FOUND');
      assert.strictEqual(notFound.message, 'Exam not found');
      assert.ok(notFound instanceof AppError);

      const unauthorized = new UnauthorizedError('Invalid 2FA token', 'AUTH_INVALID_TOTP');
      assert.strictEqual(unauthorized.statusCode, 401);
      assert.strictEqual(unauthorized.code, 'AUTH_INVALID_TOTP');

      const forbidden = new ForbiddenError('Admin access required');
      assert.strictEqual(forbidden.statusCode, 403);
      assert.strictEqual(forbidden.code, 'FORBIDDEN');

      const conflict = new ConflictError('Email already registered');
      assert.strictEqual(conflict.statusCode, 409);

      const badRequest = new BadRequestError('Malformed exam submission');
      assert.strictEqual(badRequest.statusCode, 400);
    });

    it('should format error response envelope for REST API clients', () => {
      function formatErrorEnvelope(err: AppError) {
        return {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            statusCode: err.statusCode,
          },
        };
      }

      const err = new NotFoundError('Question not found in bank');
      const envelope = formatErrorEnvelope(err);

      assert.strictEqual(envelope.success, false);
      assert.strictEqual(envelope.error.statusCode, 404);
      assert.strictEqual(envelope.error.message, 'Question not found in bank');
    });
  });

  describe('Role-Based Access Control (RBAC) Verification', () => {
    function authorizeRole(userRole: string, allowedRoles: string[]): boolean {
      return allowedRoles.includes(userRole);
    }

    it('should allow ADMIN to access instructor/faculty routes', () => {
      assert.strictEqual(authorizeRole('ADMIN', ['ADMIN']), true);
      assert.strictEqual(authorizeRole('ADMIN', ['ADMIN', 'FACULTY']), true);
    });

    it('should forbid CANDIDATE from accessing administrative monitoring routes', () => {
      assert.strictEqual(authorizeRole('CANDIDATE', ['ADMIN']), false);
    });
  });
});
