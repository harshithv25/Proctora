import { api, setAccessToken, getAccessToken, getErrorMessage } from '../lib/api';

export type AuthRole = 'CANDIDATE' | 'ADMIN';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  rollNumber?: string;
}

export interface AuthFormData {
  name: string;
  email: string;
  rollNumber: string;
  password: string;
  confirmPassword: string;
  totpCode: string;
}

function getInitialUser(): AuthUser | null {
  const cached = localStorage.getItem('proctora_user');
  return cached ? JSON.parse(cached) : null;
}

function createAuthStore() {
  let user = $state<AuthUser | null>(getInitialUser());
  let isAuthenticated = $state<boolean>(!!getAccessToken());
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let requires2fa = $state(false);

  let form = $state<AuthFormData>({
    name: '',
    email: '',
    rollNumber: '',
    password: '',
    confirmPassword: '',
    totpCode: '',
  });

  function setError(msg: string | null) {
    error = msg;
  }

  function setLoading(state: boolean) {
    isLoading = state;
  }

  function setRequires2FA(val: boolean) {
    requires2fa = val;
  }

  function updateField(field: keyof AuthFormData, value: string) {
    form = { ...form, [field]: value };
  }

  function resetForm() {
    form = {
      name: '',
      email: '',
      rollNumber: '',
      password: '',
      confirmPassword: '',
      totpCode: '',
    };
    error = null;
    requires2fa = false;
  }

  function setUser(userData: AuthUser | null) {
    user = userData;
    isAuthenticated = userData !== null;
    if (userData) {
      localStorage.setItem('proctora_user', JSON.stringify(userData));
    } else {
      localStorage.removeItem('proctora_user');
      setAccessToken(null);
    }
  }

  async function login(email: string, password: string, totpCode?: string) {
    isLoading = true;
    error = null;
    try {
      const res = await api.post('/auth/login', {
        email: email.trim(),
        password,
        ...(totpCode ? { totpCode: totpCode.trim() } : {}),
      });

      const { accessToken, user: userData } = res.data.data;
      setAccessToken(accessToken);
      setUser(userData);
      requires2fa = false;
      return { success: true, user: userData };
    } catch (err: any) {
      const code = err.response?.data?.error?.code;
      if (code === 'AUTH_2FA_REQUIRED') {
        requires2fa = true;
        error = null;
        return { success: false, requires2fa: true };
      }
      const msg = getErrorMessage(err);
      error = msg;
      return { success: false, error: msg };
    } finally {
      isLoading = false;
    }
  }

  async function register(payload: { name: string; email: string; rollNumber?: string; password: string }) {
    isLoading = true;
    error = null;
    try {
      const res = await api.post('/auth/register', {
        name: payload.name.trim(),
        email: payload.email.trim(),
        ...(payload.rollNumber?.trim() ? { rollNumber: payload.rollNumber.trim() } : {}),
        password: payload.password,
      });
      return { success: true, user: res.data.data.user };
    } catch (err) {
      const msg = getErrorMessage(err);
      error = msg;
      return { success: false, error: msg };
    } finally {
      isLoading = false;
    }
  }

  async function setup2FA() {
    isLoading = true;
    error = null;
    try {
      const res = await api.post('/auth/2fa/setup', {});
      return { success: true, data: res.data.data as { secret: string; otpauthUrl: string } };
    } catch (err) {
      const msg = getErrorMessage(err);
      error = msg;
      return { success: false, error: msg };
    } finally {
      isLoading = false;
    }
  }

  async function logout() {
    try {
      await api.post('/auth/logout', {});
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      setUser(null);
      resetForm();
    }
  }

  return {
    get user()            { return user; },
    get isAuthenticated() { return isAuthenticated; },
    get isLoading()       { return isLoading; },
    get error()           { return error; },
    get requires2fa()     { return requires2fa; },
    get form()            { return form; },
    setError,
    setLoading,
    setRequires2FA,
    updateField,
    resetForm,
    setUser,
    login,
    register,
    setup2FA,
    logout,
  };
}

export const authStore = createAuthStore();
