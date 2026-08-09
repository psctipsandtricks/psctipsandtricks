import {
  Book,
  Quiz,
  QuizSubmissionPayload,
  QuizResult,
  LeaderboardEntry,
  Order,
  AuthResponse,
  User,
  ChatGroupWithUserState,
  ChatMessage,
  ChatMessageType,
  MockTest,
  MockTestParticipant,
  MockTestStatus,
} from '@psc/shared-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

async function fetcher<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
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
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `API Error: ${res.statusText}`);
  }

  return res.json();
}

export const ApiClient = {
  // Auth & Users
  login: (data: any) => fetcher<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: any) => fetcher<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => fetcher<User>('/auth/me'),
  getUsers: () => fetcher<User[]>('/users'),

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
  createOrder: (payload: { bookId?: string; quizId?: string; amount: number }) =>
    fetcher<Order>('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  verifyPayment: (payload: { orderId: string; paymentId: string }) =>
    fetcher<Order>('/orders/verify', { method: 'POST', body: JSON.stringify(payload) }),

  // Community Chat
  getChatGroups: () => fetcher<ChatGroupWithUserState[]>('/chat/groups/mine'),
  joinGroup: (groupId: string) => fetcher(`/chat/groups/${groupId}/join`, { method: 'POST' }),
  leaveGroup: (groupId: string) => fetcher(`/chat/groups/${groupId}/leave`, { method: 'POST' }),
  pinGroup: (groupId: string) => fetcher(`/chat/groups/${groupId}/pin`, { method: 'POST' }),
  unpinGroup: (groupId: string) => fetcher(`/chat/groups/${groupId}/pin`, { method: 'DELETE' }),
  getGroupMessages: (groupId: string) => fetcher<ChatMessage[]>(`/chat/groups/${groupId}/messages`),
  sendGroupMessage: (
    groupId: string,
    payload: { content: string; messageType?: ChatMessageType; mediaUrl?: string; metadata?: Record<string, any> },
  ) => fetcher<ChatMessage>(`/chat/groups/${groupId}/messages`, { method: 'POST', body: JSON.stringify(payload) }),
  markGroupRead: (groupId: string, lastReadMessageId?: string) =>
    fetcher(`/chat/groups/${groupId}/read`, { method: 'POST', body: JSON.stringify({ lastReadMessageId }) }),
  updateMessageMetadata: (messageId: string, metadata: Record<string, any>) =>
    fetcher<ChatMessage>(`/chat/messages/${messageId}/metadata`, { method: 'PATCH', body: JSON.stringify({ metadata }) }),

  // Community Chat — Admin
  getAllChatGroups: () => fetcher<any[]>('/chat/groups'),
  createChatGroup: (payload: { name: string; description: string; category: string; iconEmoji: string; coverGradient?: string }) =>
    fetcher('/chat/groups', { method: 'POST', body: JSON.stringify(payload) }),
  updateChatGroup: (groupId: string, payload: Partial<{ name: string; description: string; category: string; iconEmoji: string }>) =>
    fetcher(`/chat/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  toggleGroupLock: (groupId: string) => fetcher(`/chat/groups/${groupId}/lock`, { method: 'PATCH' }),
  deleteChatGroup: (groupId: string) => fetcher(`/chat/groups/${groupId}`, { method: 'DELETE' }),
  getGroupMembers: (groupId: string) => fetcher<any[]>(`/chat/groups/${groupId}/members`),
  removeGroupMember: (groupId: string, userId: string) =>
    fetcher(`/chat/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  postAnnouncement: (
    groupId: string,
    payload: { content: string; metadata?: Record<string, any> },
  ) => fetcher<ChatMessage>(`/chat/groups/${groupId}/announce`, { method: 'POST', body: JSON.stringify(payload) }),
};
