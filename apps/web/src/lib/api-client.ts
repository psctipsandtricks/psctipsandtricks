import { Book, Quiz, QuizSubmissionPayload, QuizResult, LeaderboardEntry, Order, AuthResponse } from '@psc/shared-types';

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
  // Auth
  login: (data: any) => fetcher<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: any) => fetcher<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  // Books
  getBooks: () => fetcher<Book[]>('/books'),
  getBookById: (id: string) => fetcher<Book>(`/books/${id}`),

  // Quizzes
  getQuizzes: () => fetcher<Quiz[]>('/quizzes'),
  getQuizById: (id: string) => fetcher<Quiz>(`/quizzes/${id}`),
  submitQuiz: (id: string, payload: QuizSubmissionPayload) =>
    fetcher<QuizResult>(`/quizzes/${id}/submit`, { method: 'POST', body: JSON.stringify(payload) }),
  getLeaderboard: (id: string) => fetcher<LeaderboardEntry[]>(`/quizzes/${id}/leaderboard`),

  // Orders
  createOrder: (payload: { bookId?: string; quizId?: string; amount: number }) =>
    fetcher<Order>('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  verifyPayment: (payload: { orderId: string; paymentId: string }) =>
    fetcher<Order>('/orders/verify', { method: 'POST', body: JSON.stringify(payload) }),
};
