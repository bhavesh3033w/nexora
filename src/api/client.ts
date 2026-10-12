
import axios from 'axios';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5000/api/v1';

// Secure in-memory token with localStorage fallback for session restoration
const TOKEN_KEY = 'nexora_auth_token';
let accessToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 10000,
});

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

const FRIENDLY: Record<string, string> = {
  GOOGLE_NOT_CONFIGURED:
    'Google integration is not configured on the server.',
  GOOGLE_NOT_CONNECTED:
    'Your Google account is not connected. Connect it first.',
  GOOGLE_TOKEN_EXPIRED:
    'Your Google connection expired or was revoked. Please reconnect.',
  GOOGLE_PERMISSION_MISSING:
    'Google permissions are missing. Reconnect and approve the requested access.',
  GOOGLE_API_ERROR:
    'Google returned an error. Please try again shortly.',
  TRANSCRIPT_NOT_AVAILABLE:
    'Transcript unavailable for this meeting.',
  TRANSCRIPT_PENDING:
    'Waiting for the meeting transcript.',
  TRANSCRIPT_TOO_LARGE:
    'The transcript is too large.',
  UNSUPPORTED_FILE_TYPE:
    'Unsupported file type. Use .txt, .vtt, .srt or .md.',
  AI_PROVIDER_ERROR:
    'The AI provider failed or is not configured on the server.',
  MEETING_NOT_FOUND:
    'Meeting not found.',
  FORBIDDEN:
    'You do not have access to this resource.',
  VALIDATION_ERROR:
    'Some fields are invalid.',
  INVALID_RESPONSE:
    'The server returned a response the app could not understand.',
};

export class ApiError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? FRIENDLY[code] ?? code);
    this.name = 'ApiError';
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Cannot reach the Nexora API. Check that the backend is running and VITE_API_BASE_URL is correct.';
    }

    const data = error.response.data as
      | { code?: string; error?: string; message?: string }
      | undefined;

    if (data?.code && FRIENDLY[data.code]) {
      return data.message
        ? `${FRIENDLY[data.code]} (${data.message})`
        : FRIENDLY[data.code];
    }

    if (error.response.status === 401) {
      return data?.error ?? 'Your session expired. Please sign in again.';
    }

    if (error.response.status === 403) {
      return data?.error ?? FRIENDLY.FORBIDDEN;
    }

    if (
      error.response.status === 404 ||
      error.response.status === 405 ||
      error.response.status === 501
    ) {
      return data?.message ?? 'This feature is not available on the server yet.';
    }

    return data?.message ?? data?.error ?? `Request failed (${error.response.status}).`;
  }

  return error instanceof Error
    ? error.message
    : 'Something went wrong.';
}

export const isHttpStatus = (
  error: unknown,
  ...codes: number[]
) =>
  axios.isAxiosError(error) &&
  !!error.response &&
  codes.includes(error.response.status);
