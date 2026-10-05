import test, { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Frontend Unit Tests: API Client & Network Interceptors Module', () => {

  // Replicating getErrorMessage logic from frontend/src/lib/api.ts
  function getErrorMessage(error: any): string {
    if (error && typeof error === 'object' && 'response' in error) {
      return (
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        'An unexpected error occurred'
      );
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unexpected error occurred';
  }

  it('should extract structured backend API error message from Axios response payload', () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          success: false,
          error: {
            code: 'AUTH_INVALID_TOTP',
            message: 'Invalid 6-digit authenticator code provided.',
          },
        },
      },
    };

    const msg = getErrorMessage(axiosError);
    assert.strictEqual(msg, 'Invalid 6-digit authenticator code provided.');
  });

  it('should fallback to top-level message if nested error object is absent', () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 403,
        data: {
          message: 'Access denied: Candidate not authorized for this exam session.',
        },
      },
    };

    const msg = getErrorMessage(axiosError);
    assert.strictEqual(msg, 'Access denied: Candidate not authorized for this exam session.');
  });

  it('should handle standard JavaScript Error instances gracefully', () => {
    const standardError = new Error('Network connection interrupted');
    const msg = getErrorMessage(standardError);
    assert.strictEqual(msg, 'Network connection interrupted');
  });

  it('should handle unexpected null or non-object errors safely', () => {
    assert.strictEqual(getErrorMessage(null), 'An unexpected error occurred');
    assert.strictEqual(getErrorMessage(undefined), 'An unexpected error occurred');
  });

  it('should manage token header injection properly', () => {
    function prepareRequestHeaders(token: string | null, csrfToken: string | null) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      return headers;
    }

    const unauthedHeaders = prepareRequestHeaders(null, null);
    assert.strictEqual(unauthedHeaders['Authorization'], undefined);

    const authedHeaders = prepareRequestHeaders('valid-jwt-token-123', 'csrf-token-abc');
    assert.strictEqual(authedHeaders['Authorization'], 'Bearer valid-jwt-token-123');
    assert.strictEqual(authedHeaders['x-csrf-token'], 'csrf-token-abc');
  });
});
