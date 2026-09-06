import axios from 'axios';

let csrfToken: string | null = null;
let accessToken: string | null = localStorage.getItem('proctora_access_token');

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    localStorage.setItem('proctora_access_token', token);
  } else {
    localStorage.removeItem('proctora_access_token');
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await axios.get('/api/csrf-token', { withCredentials: true });
    const token = res.data?.data?.csrfToken || '';
    csrfToken = token;
    return token;
  } catch (err) {
    console.error('Failed to fetch CSRF token:', err);
    return '';
  }
}

api.interceptors.request.use(async (config) => {
  if (!csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
    await fetchCsrfToken();
  }

  if (csrfToken) {
    config.headers['x-csrf-token'] = csrfToken;
  }

  if (accessToken) {
    config.headers['Authorization'] = `Bearer ${accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      try {
        const refreshRes = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const newToken = refreshRes.data?.data?.accessToken;
        if (newToken) {
          setAccessToken(newToken);
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch {
        setAccessToken(null);
      }
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
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
