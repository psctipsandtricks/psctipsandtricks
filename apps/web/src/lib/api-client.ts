import {
  Book,
  Quiz,
  QuizSubmissionPayload,
  QuizResult,
  LeaderboardEntry,
  Order,
  OrderWithItems,
  UserProfile,
  AuthResponse,
  User,
  ChatGroupWithUserState,
  ChatMessage,
  ChatMessageType,
  MockTest,
  MockTestParticipant,
  MockTestStatus,
  StudentDashboard,
} from '@psc/shared-types';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

// The admin panel keeps a completely separate session from the student site —
// separate storage keys, separate refresh/expiry handling — so being logged
// in on one surface never implies access on the other. Which pair a request
// uses is decided by the URL it's made from: anything under /admin is an
// admin-panel request.
const STUDENT_ACCESS_TOKEN_KEY = 'accessToken';
const STUDENT_REFRESH_TOKEN_KEY = 'refreshToken';
const STUDENT_USER_KEY = 'psc_user';
export const ADMIN_ACCESS_TOKEN_KEY = 'adminAccessToken';
export const ADMIN_REFRESH_TOKEN_KEY = 'adminRefreshToken';
export const ADMIN_USER_KEY = 'psc_admin_user';

function isAdminContext(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
}

/** The access token for whichever session (student or admin) is active on the current page. */
export function getActiveAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(isAdminContext() ? ADMIN_ACCESS_TOKEN_KEY : STUDENT_ACCESS_TOKEN_KEY);
}

// Deduped in-flight refresh: concurrent 401s on the same session share one
// /auth/refresh call. Student and admin sessions get independent promises so
// a refresh on one surface can never be satisfied with the other's token.
let studentRefreshPromise: Promise<string | null> | null = null;
let adminRefreshPromise: Promise<string | null> | null = null;

async function tryRefreshAccessToken(admin: boolean): Promise<string | null> {
  const accessKey = admin ? ADMIN_ACCESS_TOKEN_KEY : STUDENT_ACCESS_TOKEN_KEY;
  const refreshKey = admin ? ADMIN_REFRESH_TOKEN_KEY : STUDENT_REFRESH_TOKEN_KEY;
  const existing = admin ? adminRefreshPromise : studentRefreshPromise;

  const promise =
    existing ||
    (async () => {
      const refreshToken = localStorage.getItem(refreshKey);
      if (!refreshToken) return null;
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.accessToken) return null;
        localStorage.setItem(accessKey, data.accessToken);
        if (data.refreshToken) localStorage.setItem(refreshKey, data.refreshToken);
        return data.accessToken as string;
      } catch {
        return null;
      }
    })().finally(() => {
      if (admin) adminRefreshPromise = null;
      else studentRefreshPromise = null;
    });

  if (admin) adminRefreshPromise = promise;
  else studentRefreshPromise = promise;
  return promise;
}

// Stored token is dead and unrefreshable — drop the session so the UI returns
// to logged-out instead of firing doomed authorized requests forever.
// auth-provider / admin-auth-provider listen for their respective event.
function clearExpiredSession(admin: boolean) {
  if (typeof window === 'undefined') return;
  if (admin) {
    localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
    localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    window.dispatchEvent(new Event('psc:admin-session-expired'));
  } else {
    localStorage.removeItem(STUDENT_ACCESS_TOKEN_KEY);
    localStorage.removeItem(STUDENT_REFRESH_TOKEN_KEY);
    localStorage.removeItem(STUDENT_USER_KEY);
    window.dispatchEvent(new Event('psc:session-expired'));
  }
}

async function fetcher<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const admin = isAdminContext();
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem(admin ? ADMIN_ACCESS_TOKEN_KEY : STUDENT_ACCESS_TOKEN_KEY)
      : null;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    // Expired access token: refresh once and retry. Skip /auth/* — a 401 there
    // is a credential failure, not an expired session.
    if (res.status === 401 && token && !endpoint.startsWith('/auth/')) {
      const newToken = await tryRefreshAccessToken(admin);
      if (newToken) {
        const retry = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers: { ...headers, Authorization: `Bearer ${newToken}` },
        });
        if (retry.ok) return retry.json();
      }
      clearExpiredSession(admin);
    }
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `API Error: ${res.statusText}`);
  }

  return res.json();
}

async function uploadFetcher<T>(endpoint: string, file: File): Promise<T> {
  const admin = isAdminContext();
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem(admin ? ADMIN_ACCESS_TOKEN_KEY : STUDENT_ACCESS_TOKEN_KEY)
      : null;
  const body = new FormData();
  body.append('file', file);

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body,
  });

  if (!res.ok) {
    if (res.status === 401 && token) {
      const newToken = await tryRefreshAccessToken(admin);
      if (newToken) {
        const retry = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${newToken}` },
          body,
        });
        if (retry.ok) return retry.json();
      }
      clearExpiredSession(admin);
    }
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Upload failed: ${res.statusText}`);
  }
  return res.json();
}

async function uploadFetcherWithProgress<T>(
  endpoint: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<T> {
  const admin = isAdminContext();
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem(admin ? ADMIN_ACCESS_TOKEN_KEY : STUDENT_ACCESS_TOKEN_KEY)
      : null;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}${endpoint}`);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText);
          resolve(parsed);
        } catch {
          resolve({} as T);
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.message || `Upload failed: ${xhr.statusText}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error occurred during file upload.'));
    xhr.ontimeout = () => reject(new Error('Upload request timed out.'));

    const body = new FormData();
    body.append('file', file);
    xhr.send(body);
  });
}

export const ApiClient = {
  // Auth & Users
  login: (data: any) => fetcher<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: any) => fetcher<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => fetcher<User>('/auth/me'),
  getUsers: () => fetcher<User[]>('/users'),
  createUser: (payload: any) => fetcher<User>('/users', { method: 'POST', body: JSON.stringify(payload) }),
  adminUpdateUser: (id: string, payload: any) =>
    fetcher<User>(`/users/${id}/admin`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getUserProfile: (id: string) => fetcher<UserProfile>(`/users/${id}`),
  updateMyProfile: (id: string, payload: Partial<{ name: string; phoneNumber: string; avatarUrl: string }>) =>
    fetcher<UserProfile>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  uploadAvatar: (id: string, file: File) => uploadFetcher<UserProfile>(`/users/${id}/avatar`, file),
  removeAvatar: (id: string) => fetcher<UserProfile>(`/users/${id}/avatar`, { method: 'DELETE' }),

  // Books
  getBooks: () => fetcher<Book[]>('/books'),
  getBookById: (id: string) => fetcher<Book>(`/books/${id}`),

  // Quizzes
  getQuizzes: () => fetcher<Quiz[]>('/quizzes'),
  getPublishedQuizzes: () => fetcher<Quiz[]>('/quizzes?publishedOnly=true'),
  getQuizById: (id: string) => fetcher<Quiz>(`/quizzes/${id}`),
  createQuiz: (payload: any) =>
    fetcher<any>('/quizzes', { method: 'POST', body: JSON.stringify(payload) }),
  updateQuiz: (id: string, payload: any) =>
    fetcher<any>(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteQuiz: (id: string) =>
    fetcher<any>(`/quizzes/${id}`, { method: 'DELETE' }),
  submitQuiz: (id: string, payload: QuizSubmissionPayload) =>
    fetcher<QuizResult>(`/quizzes/${id}/submit`, { method: 'POST', body: JSON.stringify(payload) }),
  startQuizAttempt: (quizId: string) => fetcher<any>(`/quizzes/${quizId}/attempts/start`, { method: 'POST' }),
  getActiveQuizAttempt: (quizId: string) => fetcher<any>(`/quizzes/${quizId}/attempts/active`),
  submitQuizAttempt: (quizId: string, payload: QuizSubmissionPayload, attemptId?: string) =>
    fetcher<QuizResult>(`/quizzes/${quizId}/submit${attemptId ? `?attemptId=${attemptId}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getStudentAttemptHistory: () => fetcher<any[]>('/quizzes/history/me'),
  getMyDashboard: () => fetcher<StudentDashboard>('/analytics/me/dashboard'),
  getAdminAttemptHistory: (quizId?: string, userId?: string) =>
    fetcher<any[]>(`/quizzes/admin/attempts?${quizId ? `quizId=${quizId}&` : ''}${userId ? `userId=${userId}` : ''}`),
  getLeaderboard: (id: string) => fetcher<LeaderboardEntry[]>(`/quizzes/${id}/leaderboard`),

  // Mock Tests
  getMockTests: (status?: MockTestStatus) =>
    fetcher<any[]>(`/mock-tests${status ? `?status=${status}` : ''}`),
  getMockTestById: (id: string) => fetcher<any>(`/mock-tests/${id}`),
  getMockTestLeaderboard: (id: string) => fetcher<LeaderboardEntry[]>(`/mock-tests/${id}/leaderboard`),
  createMockTest: (payload: { title: string; quizId: string; scheduledAt: string }) =>
    fetcher<MockTest>('/mock-tests', { method: 'POST', body: JSON.stringify(payload) }),
  updateMockTest: (id: string, payload: Partial<{ title: string; quizId: string; scheduledAt: string }>) =>
    fetcher<MockTest>(`/mock-tests/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  joinMockTest: (id: string) => fetcher<MockTestParticipant>(`/mock-tests/${id}/join`, { method: 'POST' }),
  submitMockTest: (id: string, payload: QuizSubmissionPayload) =>
    fetcher<MockTestParticipant>(`/mock-tests/${id}/submit`, { method: 'POST', body: JSON.stringify(payload) }),
  getMyMockTestAttempts: () => fetcher<MockTestParticipant[]>('/mock-tests/my-attempts'),
  deleteMockTest: (id: string) => fetcher<any>(`/mock-tests/${id}`, { method: 'DELETE' }),

  // Orders
  createOrder: (payload: { bookId?: string; quizId?: string; amount: number; couponCode?: string }) =>
    fetcher<Order & { keyId?: string; mode?: string; isSimulated?: boolean }>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  verifyPayment: (payload: {
    orderId: string;
    paymentId: string;
    razorpayOrderId?: string;
    razorpaySignature?: string;
  }) => fetcher<Order>('/orders/verify', { method: 'POST', body: JSON.stringify(payload) }),
  getAllOrders: () => fetcher<any[]>('/orders'),
  getMyOrders: () => fetcher<OrderWithItems[]>('/orders/me'),

  // Community Chat
  getChatGroups: () => fetcher<ChatGroupWithUserState[]>('/chat/groups/mine'),
  joinGroup: (groupId: string) => fetcher(`/chat/groups/${groupId}/join`, { method: 'POST' }),
  leaveGroup: (groupId: string) => fetcher(`/chat/groups/${groupId}/leave`, { method: 'POST' }),
  pinGroup: (groupId: string) => fetcher(`/chat/groups/${groupId}/pin`, { method: 'POST' }),
  unpinGroup: (groupId: string) => fetcher(`/chat/groups/${groupId}/pin`, { method: 'DELETE' }),
  getGroupMessages: (groupId: string, opts?: { before?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (opts?.before) qs.set('before', opts.before);
    if (opts?.limit) qs.set('limit', String(opts.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return fetcher<ChatMessage[]>(`/chat/groups/${groupId}/messages${suffix}`);
  },
  sendGroupMessage: (
    groupId: string,
    payload: { content: string; messageType?: ChatMessageType; mediaUrl?: string; metadata?: Record<string, any> },
  ) => fetcher<ChatMessage>(`/chat/groups/${groupId}/messages`, { method: 'POST', body: JSON.stringify(payload) }),
  markGroupRead: (groupId: string, lastReadMessageId?: string) =>
    fetcher(`/chat/groups/${groupId}/read`, { method: 'POST', body: JSON.stringify({ lastReadMessageId }) }),
  updateMessageMetadata: (messageId: string, metadata: Record<string, any>) =>
    fetcher<ChatMessage>(`/chat/messages/${messageId}/metadata`, { method: 'PATCH', body: JSON.stringify({ metadata }) }),
  deleteMessage: (messageId: string) => fetcher(`/chat/messages/${messageId}`, { method: 'DELETE' }),

  // Community Chat — Admin
  getAllChatGroups: () => fetcher<any[]>('/chat/groups'),
  uploadGroupImage: (groupId: string, file: File) =>
    uploadFetcher<any>(`/chat/groups/${groupId}/image`, file),
  uploadChatAttachment: (file: File) =>
    uploadFetcher<{ name: string; url: string; type: 'pdf' | 'excel' | 'word' | 'image' | 'file'; size: string }>(
      '/chat/upload-attachment',
      file,
    ),
  uploadChatAttachmentWithProgress: (
    file: File,
    onProgress?: (percent: number) => void,
  ) =>
    uploadFetcherWithProgress<{ name: string; url: string; type: 'pdf' | 'excel' | 'word' | 'image' | 'file'; size: string }>(
      '/chat/upload-attachment',
      file,
      onProgress,
    ),
  createChatGroup: (payload: { name: string; description: string; category: string; iconEmoji?: string; imageUrl?: string; coverGradient?: string }) =>
    fetcher('/chat/groups', { method: 'POST', body: JSON.stringify(payload) }),
  updateChatGroup: (
    groupId: string,
    payload: Partial<{
      name: string;
      description: string;
      category: string;
      iconEmoji: string;
      imageUrl: string;
      allowTextMessages: boolean;
      allowPolls: boolean;
    }>,
  ) =>
    fetcher(`/chat/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  toggleGroupLock: (groupId: string) => fetcher(`/chat/groups/${groupId}/lock`, { method: 'PATCH' }),
  deleteChatGroup: (groupId: string) => fetcher(`/chat/groups/${groupId}`, { method: 'DELETE' }),
  getGroupMembers: (
    groupId: string,
    opts?: { search?: string; page?: number; limit?: number; status?: 'ALL' | 'ACTIVE' | 'BLOCKED' },
  ) => {
    const qs = new URLSearchParams();
    if (opts?.search) qs.set('search', opts.search);
    if (opts?.page) qs.set('page', String(opts.page));
    if (opts?.limit) qs.set('limit', String(opts.limit));
    if (opts?.status && opts.status !== 'ALL') qs.set('status', opts.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return fetcher<any>(`/chat/groups/${groupId}/members${suffix}`);
  },
  removeGroupMember: (groupId: string, userId: string) =>
    fetcher(`/chat/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  blockGroupMember: (groupId: string, userId: string) =>
    fetcher(`/chat/groups/${groupId}/members/${userId}/block`, { method: 'POST' }),
  unblockGroupMember: (groupId: string, userId: string) =>
    fetcher(`/chat/groups/${groupId}/members/${userId}/block`, { method: 'DELETE' }),
  postAnnouncement: (
    groupId: string,
    payload: { content: string; metadata?: Record<string, any> },
  ) => fetcher<ChatMessage>(`/chat/groups/${groupId}/announce`, { method: 'POST', body: JSON.stringify(payload) }),
};
