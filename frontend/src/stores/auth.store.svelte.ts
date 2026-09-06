
type AuthMode = 'login' | 'register';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'CANDIDATE' | 'ADMIN';
}

interface AuthFormData {
  name: string;
  email: string;
  rollNumber: string;
  password: string;
  confirmPassword: string;
}

function createAuthStore() {
  let user = $state<AuthUser | null>(null);
  let isAuthenticated = $state(false);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let mode = $state<AuthMode>('login');

  let form = $state<AuthFormData>({
    name: '',
    email: '',
    rollNumber: '',
    password: '',
    confirmPassword: '',
  });

  function setMode(newMode: AuthMode) {
    mode = newMode;
    error = null;
    resetForm();
  }

  function setError(msg: string | null) {
    error = msg;
  }

  function setLoading(state: boolean) {
    isLoading = state;
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
    };
  }

  function setUser(userData: AuthUser | null) {
    user = userData;
    isAuthenticated = userData !== null;
  }

  function logout() {
    user = null;
    isAuthenticated = false;
    resetForm();
    error = null;
  }

  return {
    get user()            { return user; },
    get isAuthenticated() { return isAuthenticated; },
    get isLoading()       { return isLoading; },
    get error()           { return error; },
    get mode()            { return mode; },
    get form()            { return form; },
    setMode,
    setError,
    setLoading,
    updateField,
    resetForm,
    setUser,
    logout,
  };
}

export const authStore = createAuthStore();
