import type {
  ApiErrorBody,
  ConversationDetail,
  ConversationSummary,
  GenerateResponse,
  Message,
  PublicUser,
} from '@/lib/types';

/** Error thrown by the fetch helpers below, with a friendly message + retry flag. */
export class ClientApiError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(status: number, message: string, code: string, retryable: boolean) {
    super(message);
    this.name = 'ClientApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      /* non-JSON error body */
    }
    if (body?.error) {
      throw new ClientApiError(res.status, body.error.message, body.error.code, body.error.retryable);
    }
    throw new ClientApiError(res.status, `Request failed (${res.status}). Please try again.`, 'http', res.status >= 500);
  }

  return (await res.json()) as T;
}

export const api = {
  getMe: () => apiFetch<PublicUser>('/api/me'),
  listConversations: () => apiFetch<ConversationSummary[]>('/api/conversations'),
  getConversation: (id: string) => apiFetch<ConversationDetail>(`/api/conversations/${id}`),
  register: (body: { name: string; email: string; password: string }) =>
    apiFetch<{ user: PublicUser }>('/api/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    apiFetch<{ user: PublicUser }>('/api/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => apiFetch<{ ok: true }>('/api/logout', { method: 'POST' }),
  createConversation: (body: { topic: string; difficulty: string }) =>
    apiFetch<ConversationSummary>('/api/conversations', { method: 'POST', body: JSON.stringify(body) }),
  sendMessage: (conversationId: string, content: string) =>
    apiFetch<{ userMessage: Message; assistantMessage: Message }>(
      `/api/conversations/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify({ content }) },
    ),
  generate: (body: { conversationId: string; mode: 'explain' | 'notes' | 'quiz' | 'plan' }) =>
    apiFetch<GenerateResponse>('/api/generate', { method: 'POST', body: JSON.stringify(body) }),
  uploadFile: (formData: FormData) =>
    apiFetch<ConversationSummary>('/api/upload', { method: 'POST', body: formData }),
  exportUrl: (conversationId: string, type: 'notes' | 'quiz' | 'plan') =>
    `/api/conversations/${conversationId}/export?type=${type}`,
};