// Typed service layer connecting to the real Express backend (VITE_API_BASE_URL).
import axios from 'axios';
import { ApiError, http, setAccessToken } from './client';
import type {
  AdminUser,
  AssistantReply,
  Client,
  Course,
  DayRow,
  GoogleStatus,
  LogEntry,
  Meeting,
  MeetingInput,
  Message,
  Prefs,
  Project,
  Role,
  Session,
  StartResult,
  Task,
} from '../types';

/** Guards and normalizes API list responses, handling both raw JSON arrays and { success, data } envelopes. */
export const arr = <T,>(d: unknown): T[] => {
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === 'object') {
    if ('data' in d && Array.isArray((d as any).data)) return (d as any).data as T[];
    if ('items' in d && Array.isArray((d as any).items)) return (d as any).items as T[];
  }
  throw new ApiError('INVALID_RESPONSE');
};

export const authService = {
  login: async (
    portal: Role,
    email: string,
    password: string,
  ): Promise<Session> => {
    const response = await http.post<{
      success: boolean;
      data: {
        token: string;
        user: {
          _id?: string;
          id?: string;
          name: string;
          email: string;
          role: Role;
        };
      };
    }>(`/auth/${portal}/login`, { email, password });

    const user = response.data?.data?.user;
    const token = response.data?.data?.token;

    if (!response.data?.success || !user || !token) {
      throw new ApiError('INVALID_RESPONSE');
    }

    setAccessToken(token);

    return {
      id: user.id ?? user._id ?? '',
      name: user.name,
      email: user.email,
      role: user.role,
    };
  },
  register: async (name: string, email: string, password: string): Promise<Session> => {
    const res = await http.post<any>('/auth/user/register', { name, email, password });
    const payload = res.data?.data || res.data;
    const token = payload?.token;
    if (token) setAccessToken(token);
    const user = payload?.user || payload;
    return {
      id: user.id ?? user._id ?? '',
      name: user.name,
      email: user.email,
      role: user.role,
    };
  },
  me: async (): Promise<Session> => {
    const res = await http.get<any>('/auth/me');
    const payload = res.data?.data || res.data;
    const user = payload?.user || payload;
    return {
      id: user.id ?? user._id ?? '',
      name: user.name,
      email: user.email,
      role: user.role,
    };
  },
  logout: async () => {
    try {
      await http.post('/auth/logout');
    } finally {
      setAccessToken(null);
    }
  },
};

export const preferencesService = {
  /** Resolves to null when the server has no saved preferences yet (404 or empty body); any other failure throws. */
  get: async (): Promise<Prefs | null> => {
    try {
      const r = await http.get<any>('/users/me/preferences');
      const d = r.data?.data ?? r.data;
      return d && typeof d === 'object' ? d : null;
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 404) return null;
      throw e;
    }
  },
  save: async (p: Prefs): Promise<void> => {
    await http.put('/users/me/preferences', p);
  },
};

export const assistantService = {
  send: async (text: string): Promise<AssistantReply> => {
    const res = await http.post<any>('/assistant/messages', { text });
    return res.data?.data ?? res.data;
  },
};

export const adaptationService = {
  preview: async (text: string): Promise<any> => {
    const res = await http.post<any>('/adaptations/preview', { text });
    return res.data?.data ?? res.data;
  },
  apply: async (text: string, proposal?: any): Promise<any> => {
    const res = await http.post<any>('/adaptations/apply', { text, proposal });
    return res.data?.data ?? res.data;
  },
  history: async (): Promise<any[]> => {
    const res = await http.get<unknown>('/adaptations/history');
    return arr<any>((res as any).data);
  },
  undo: async (): Promise<any> => {
    const res = await http.post<any>('/adaptations/undo');
    return res.data?.data ?? res.data;
  },
};

export const adminService = {
  listUsers: async (): Promise<AdminUser[]> => arr<AdminUser>((await http.get<unknown>('/admin/users')).data),
  setStatus: async (id: string, status: AdminUser['status']): Promise<void> => {
    await http.patch(`/admin/users/${id}/status`, { status });
  },
  activity: async (): Promise<LogEntry[]> => arr<LogEntry>((await http.get<unknown>('/admin/activity')).data),
  overview: async (): Promise<any> => {
    const res = await http.get<any>('/admin/dashboard');
    return res.data?.data ?? res.data;
  },
};

type Resources = {
  meetings: Meeting;
  messages: Message;
  courses: Course;
  projects: Project;
  tasks: Task;
  analytics: DayRow;
};
type Writable = 'messages' | 'courses' | 'projects' | 'tasks';

export const workspaceServices = {
  list: async <K extends keyof Resources>(resource: K): Promise<Resources[K][]> =>
    arr<Resources[K]>((await http.get<unknown>('/' + resource)).data),
  create: async <K extends Writable>(resource: K, body: Omit<Resources[K], 'id'>): Promise<Resources[K]> => {
    const res = await http.post<any>('/' + resource, body);
    return res.data?.data ?? res.data;
  },
  update: async <K extends Writable>(resource: K, id: string, body: Resources[K]): Promise<Resources[K]> => {
    const res = await http.put<any>(`/${resource}/${id}`, body);
    return res.data?.data ?? res.data;
  },
  delete: async (resource: Writable, id: string): Promise<void> => {
    await http.delete(`/${resource}/${id}`);
  },
};

// ---- Meetings + Google Meet integration ----
export const clientService = {
  list: async (): Promise<Client[]> => arr<Client>((await http.get<unknown>('/clients')).data),
};

export const googleService = {
  status: async (): Promise<GoogleStatus> => {
    const res = await http.get<any>('/integrations/google/status');
    return res.data?.data ?? res.data;
  },
  connect: async (): Promise<void> => {
    const res = await http.get<any>('/integrations/google/connect');
    const authUrl = res.data?.data?.authUrl ?? res.data?.authUrl;
    if (authUrl) {
      window.location.assign(authUrl);
    }
  },
  disconnect: async (): Promise<void> => {
    await http.delete('/integrations/google');
  },
};

export const meetingService = {
  list: async (): Promise<Meeting[]> => arr<Meeting>((await http.get<unknown>('/meetings')).data),
  get: async (id: string): Promise<Meeting> => {
    const res = await http.get<any>(`/meetings/${id}`);
    return res.data?.data ?? res.data;
  },
  create: async (i: MeetingInput): Promise<Meeting> => {
    const res = await http.post<any>('/meetings', i);
    return res.data?.data ?? res.data;
  },
  update: async (id: string, p: Partial<Meeting>): Promise<Meeting> => {
    const res = await http.patch<any>(`/meetings/${id}`, p);
    return res.data?.data ?? res.data;
  },
  schedule: async (id: string): Promise<Meeting> => {
    const res = await http.post<any>(`/meetings/${id}/schedule`);
    return res.data?.data ?? res.data;
  },
  start: async (id: string): Promise<StartResult> => {
    const res = await http.post<any>(`/meetings/${id}/start`);
    return res.data?.data ?? res.data;
  },
  complete: async (id: string): Promise<Meeting> => {
    const res = await http.post<any>(`/meetings/${id}/complete`);
    return res.data?.data ?? res.data;
  },
  processTranscript: async (id: string): Promise<Meeting> => {
    const res = await http.post<any>(`/meetings/${id}/process-transcript`);
    return res.data?.data ?? res.data;
  },
  submitTranscript: async (id: string, text: string): Promise<Meeting> => {
    const res = await http.post<any>(`/meetings/${id}/transcript`, { text });
    return res.data?.data ?? res.data;
  },
  setActionItem: async (id: string, itemId: string, done: boolean): Promise<Meeting> => {
    const res = await http.patch<any>(`/meetings/${id}/action-items/${itemId}`, { done });
    return res.data?.data ?? res.data;
  },
};