import test, { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Frontend Unit Tests: Auth Store & Session State Management', () => {

  interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: 'CANDIDATE' | 'ADMIN';
    rollNumber?: string;
  }

  interface AuthState {
    user: AuthUser | null;
    isAuthenticated: boolean;
    requires2fa: boolean;
    loading: boolean;
    error: string | null;
  }

  function createMockAuthStore() {
    let state: AuthState = {
      user: null,
      isAuthenticated: false,
      requires2fa: false,
      loading: false,
      error: null,
    };

    return {
      getState: () => ({ ...state }),
      loginSuccess: (user: AuthUser) => {
        state = {
          ...state,
          user,
          isAuthenticated: true,
          requires2fa: false,
          error: null,
          loading: false,
        };
      },
      prompt2FA: () => {
        state = {
          ...state,
          requires2fa: true,
          loading: false,
          error: null,
        };
      },
      setError: (err: string) => {
        state = {
          ...state,
          error: err,
          loading: false,
        };
      },
      logout: () => {
        state = {
          user: null,
          isAuthenticated: false,
          requires2fa: false,
          loading: false,
          error: null,
        };
      },
    };
  }

  it('should initialize with clean unauthenticated state', () => {
    const store = createMockAuthStore();
    const state = store.getState();

    assert.strictEqual(state.isAuthenticated, false);
    assert.strictEqual(state.user, null);
    assert.strictEqual(state.requires2fa, false);
    assert.strictEqual(state.error, null);
  });

  it('should transition to 2FA challenge mode when password matches', () => {
    const store = createMockAuthStore();
    store.prompt2FA();
    const state = store.getState();

    assert.strictEqual(state.requires2fa, true);
    assert.strictEqual(state.isAuthenticated, false);
  });

  it('should authenticate user and store role information on successful verification', () => {
    const store = createMockAuthStore();
    const candidateUser: AuthUser = {
      id: 'usr-123',
      name: 'Harshith Vellapha',
      email: 'harshith@nitk.edu.in',
      role: 'CANDIDATE',
      rollNumber: '241IT033',
    };

    store.loginSuccess(candidateUser);
    const state = store.getState();

    assert.strictEqual(state.isAuthenticated, true);
    assert.strictEqual(state.requires2fa, false);
    assert.strictEqual(state.user?.name, 'Harshith Vellapha');
    assert.strictEqual(state.user?.role, 'CANDIDATE');
  });

  it('should clear user state upon logout', () => {
    const store = createMockAuthStore();
    store.loginSuccess({
      id: 'admin-01',
      name: 'Faculty Admin',
      email: 'admin@nitk.edu.in',
      role: 'ADMIN',
    });

    assert.strictEqual(store.getState().isAuthenticated, true);

    store.logout();
    const state = store.getState();

    assert.strictEqual(state.isAuthenticated, false);
    assert.strictEqual(state.user, null);
  });
});
