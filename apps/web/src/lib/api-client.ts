import {
  Book,
  BookSubscriptionType,
  BookReaderContent,
  Chapter,
  Topic,
  Subtopic,
  ReadingProgress,
  Quiz,
  QuizSubmissionPayload,
  QuizResult,
  LeaderboardEntry,
  Order,
  OrderWithItems,
  Coupon,
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
  VideoExam,
  VideoChapter,
  Video,
  PdfExam,
  PdfChapter,
  PdfDocument,
  QuizFolder,
  StaffMember,
  StaffPermission,
} from '@psc/shared-types';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

/** Book fields an admin can write. `finalPrice` is intentionally absent — the server derives it from price + discountPercent. */
export interface BookWritePayload {
  title: string;
  author: string;
  description: string;
  category: string;
  price?: number;
  discountPercent?: number;
  publicationYear?: number;
  productId?: string;
  appleId?: string;
  basePlanId?: string;
  subscriptionType?: BookSubscriptionType;
  isPremium?: boolean;
  isPublished?: boolean;
  visibleToGuests?: boolean;
  previewPdfUrl?: string;
  previewPdfFileName?: string;
  previewPdfSizeBytes?: number;
}

/** Fields an admin writes on an exam or chapter folder, in either content library. */
export interface LibraryFolderPayload {
  title: string;
  description?: string;
  orderIndex?: number;
  isActive?: boolean;
}

/** One row of a reorder request — the full list is sent so indices stay contiguous. */
export interface ReorderEntry {
  id: string;
  orderIndex: number;
}

/**
 * `youtubeVideoId` and `thumbnailUrl` are intentionally absent — the server
 * derives both from the pasted link, so a video can never be listed under
 * someone else's thumbnail.
 */
export interface VideoWritePayload {
  title: string;
  description?: string;
  youtubeUrl: string;
  orderIndex?: number;
  isActive?: boolean;
  pdfUrl?: string;
  pdfFileName?: string;
  pdfSizeBytes?: number;
}

export interface QuizFolderWritePayload {
  name: string;
  description?: string;
  orderIndex?: number;
  isActive?: boolean;
}

/** The file itself goes through `uploadPdfDocumentFile`, not this payload. */
export interface PdfDocumentWritePayload {
  title: string;
  description?: string;
  orderIndex?: number;
  isActive?: boolean;
}

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
  getAdminDashboard: () =>
    fetcher<{
      totalRevenue: number;
      totalOrders: number;
      monthlyRevenue: number;
      registeredStudents: number;
      revenueChartData: { month: string; revenue: number }[];
      recentOrders: any[];
    }>('/analytics/admin/summary'),
  getUsers: (params?: { page?: number; limit?: number; search?: string; provider?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.provider && params.provider !== 'ALL') q.set('provider', params.provider);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetcher<any>(`/users${qs}`);
  },
  createUser: (payload: any) => fetcher<User>('/users', { method: 'POST', body: JSON.stringify(payload) }),
  adminUpdateUser: (id: string, payload: any) =>
    fetcher<User>(`/users/${id}/admin`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteUser: (id: string) =>
    fetcher<{ success: boolean; message: string; id: string }>(`/users/${id}`, { method: 'DELETE' }),
  getUserProfile: (id: string) => fetcher<UserProfile>(`/users/${id}`),
  updateMyProfile: (id: string, payload: Partial<{ name: string; phoneNumber: string; avatarUrl: string }>) =>
    fetcher<UserProfile>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  uploadAvatar: (id: string, file: File) => uploadFetcher<UserProfile>(`/users/${id}/avatar`, file),
  removeAvatar: (id: string) => fetcher<UserProfile>(`/users/${id}/avatar`, { method: 'DELETE' }),

  // Books
  getBooks: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    subscriptionType?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.category && params.category !== 'ALL') q.set('category', params.category);
    if (params?.subscriptionType && params.subscriptionType !== 'ALL') q.set('subscriptionType', params.subscriptionType);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetcher<any>(`/books${qs}`);
  },
  getBookById: (id: string) => fetcher<Book>(`/books/${id}`),
  downloadBook: (id: string) => fetcher<{ url: string | null; downloadCount: number }>(`/books/${id}/download`, { method: 'POST' }),
  getBookReaderContent: (id: string) => fetcher<BookReaderContent>(`/books/${id}/reader`),
  createBook: (payload: BookWritePayload & { coverUrl: string }) =>
    fetcher<Book>('/books', { method: 'POST', body: JSON.stringify(payload) }),
  updateBook: (id: string, payload: Partial<BookWritePayload>) =>
    fetcher<Book>(`/books/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteBook: (id: string) => fetcher<any>(`/books/${id}`, { method: 'DELETE' }),
  uploadBookCover: (id: string, file: File) => uploadFetcher<Book>(`/books/${id}/cover`, file),
  uploadBookPreviewPdf: (id: string, file: File, onProgress?: (percent: number) => void) =>
    uploadFetcherWithProgress<Book>(`/books/${id}/preview-pdf`, file, onProgress),
  deleteBookPreviewPdf: (id: string) => fetcher<Book>(`/books/${id}/preview-pdf`, { method: 'DELETE' }),

  // Chapters (Admin)
  getChapters: (bookId: string) => fetcher<Chapter[]>(`/books/${bookId}/chapters`),
  getChapter: (chapterId: string) => fetcher<Chapter>(`/books/chapters/${chapterId}`),
  createChapter: (bookId: string, payload: {
    title: string;
    description?: string;
    orderIndex?: number;
    isActive?: boolean;
    youtubeUrl?: string;
  }) => fetcher<Chapter>(`/books/${bookId}/chapters`, { method: 'POST', body: JSON.stringify(payload) }),
  updateChapter: (chapterId: string, payload: Partial<{
    title: string;
    description: string;
    orderIndex: number;
    isActive: boolean;
    youtubeUrl: string;
  }>) => fetcher<Chapter>(`/books/chapters/${chapterId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteChapter: (chapterId: string) => fetcher<any>(`/books/chapters/${chapterId}`, { method: 'DELETE' }),
  reorderChapters: (bookId: string, chapters: { id: string; orderIndex: number }[]) =>
    fetcher<Chapter[]>(`/books/${bookId}/chapters/reorder`, { method: 'PATCH', body: JSON.stringify({ chapters }) }),
  uploadChapterAudio: (chapterId: string, file: File) => uploadFetcher<Chapter>(`/books/chapters/${chapterId}/audio`, file),
  uploadChapterPdf: (chapterId: string, file: File) => uploadFetcher<Chapter>(`/books/chapters/${chapterId}/pdf`, file),

  // Topics (Admin)
  getTopics: (chapterId: string) => fetcher<Topic[]>(`/books/chapters/${chapterId}/topics`),
  getTopic: (topicId: string) => fetcher<Topic>(`/books/topics/${topicId}`),
  createTopic: (chapterId: string, payload: {
    title: string;
    description?: string;
    orderIndex?: number;
    isActive?: boolean;
    youtubeUrl?: string;
  }) => fetcher<Topic>(`/books/chapters/${chapterId}/topics`, { method: 'POST', body: JSON.stringify(payload) }),
  updateTopic: (topicId: string, payload: Partial<{
    title: string;
    description: string;
    orderIndex: number;
    isActive: boolean;
    youtubeUrl: string;
  }>) => fetcher<Topic>(`/books/topics/${topicId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTopic: (topicId: string) => fetcher<any>(`/books/topics/${topicId}`, { method: 'DELETE' }),
  reorderTopics: (chapterId: string, topics: { id: string; orderIndex: number }[]) =>
    fetcher<Topic[]>(`/books/chapters/${chapterId}/topics/reorder`, { method: 'PATCH', body: JSON.stringify({ topics }) }),
  uploadTopicAudio: (topicId: string, file: File) => uploadFetcher<Topic>(`/books/topics/${topicId}/audio`, file),
  uploadTopicPdf: (topicId: string, file: File) => uploadFetcher<Topic>(`/books/topics/${topicId}/pdf`, file),

  // Subtopics (Admin)
  getSubtopics: (topicId: string) => fetcher<Subtopic[]>(`/books/topics/${topicId}/subtopics`),
  createSubtopic: (topicId: string, payload: {
    title: string;
    description?: string;
    orderIndex?: number;
    isActive?: boolean;
    youtubeUrl?: string;
  }) => fetcher<Subtopic>(`/books/topics/${topicId}/subtopics`, { method: 'POST', body: JSON.stringify(payload) }),
  updateSubtopic: (subtopicId: string, payload: Partial<{
    title: string;
    description: string;
    orderIndex: number;
    isActive: boolean;
    youtubeUrl: string;
  }>) => fetcher<Subtopic>(`/books/subtopics/${subtopicId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSubtopic: (subtopicId: string) => fetcher<any>(`/books/subtopics/${subtopicId}`, { method: 'DELETE' }),
  reorderSubtopics: (topicId: string, subtopics: { id: string; orderIndex: number }[]) =>
    fetcher<Subtopic[]>(`/books/topics/${topicId}/subtopics/reorder`, { method: 'PATCH', body: JSON.stringify({ subtopics }) }),
  uploadSubtopicAudio: (subtopicId: string, file: File) => uploadFetcher<Subtopic>(`/books/subtopics/${subtopicId}/audio`, file),
  uploadSubtopicPdf: (subtopicId: string, file: File) => uploadFetcher<Subtopic>(`/books/subtopics/${subtopicId}/pdf`, file),

  // Video Library (Exam → Chapter → Video)
  // The same endpoints serve students and the admin panel; the API decides
  // whether inactive rows are included from the caller's role.
  getVideoExams: () => fetcher<VideoExam[]>('/videos/exams'),
  getVideoExam: (examId: string) => fetcher<VideoExam>(`/videos/exams/${examId}`),
  createVideoExam: (payload: LibraryFolderPayload) =>
    fetcher<VideoExam>('/videos/exams', { method: 'POST', body: JSON.stringify(payload) }),
  updateVideoExam: (examId: string, payload: Partial<LibraryFolderPayload>) =>
    fetcher<VideoExam>(`/videos/exams/${examId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteVideoExam: (examId: string) => fetcher<any>(`/videos/exams/${examId}`, { method: 'DELETE' }),
  reorderVideoExams: (items: ReorderEntry[]) =>
    fetcher<VideoExam[]>('/videos/exams/reorder', { method: 'PATCH', body: JSON.stringify({ items }) }),

  getVideoChapters: (examId: string) => fetcher<VideoChapter[]>(`/videos/exams/${examId}/chapters`),
  getVideoChapter: (chapterId: string) => fetcher<VideoChapter>(`/videos/chapters/${chapterId}`),
  createVideoChapter: (examId: string, payload: LibraryFolderPayload) =>
    fetcher<VideoChapter>(`/videos/exams/${examId}/chapters`, { method: 'POST', body: JSON.stringify(payload) }),
  updateVideoChapter: (chapterId: string, payload: Partial<LibraryFolderPayload>) =>
    fetcher<VideoChapter>(`/videos/chapters/${chapterId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteVideoChapter: (chapterId: string) => fetcher<any>(`/videos/chapters/${chapterId}`, { method: 'DELETE' }),
  reorderVideoChapters: (examId: string, items: ReorderEntry[]) =>
    fetcher<VideoChapter[]>(`/videos/exams/${examId}/chapters/reorder`, { method: 'PATCH', body: JSON.stringify({ items }) }),

  getVideos: (chapterId: string) => fetcher<Video[]>(`/videos/chapters/${chapterId}/videos`),
  createVideo: (chapterId: string, payload: VideoWritePayload) =>
    fetcher<Video>(`/videos/chapters/${chapterId}/videos`, { method: 'POST', body: JSON.stringify(payload) }),
  updateVideo: (videoId: string, payload: Partial<VideoWritePayload>) =>
    fetcher<Video>(`/videos/items/${videoId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteVideo: (videoId: string) => fetcher<any>(`/videos/items/${videoId}`, { method: 'DELETE' }),
  reorderVideos: (chapterId: string, items: ReorderEntry[]) =>
    fetcher<Video[]>(`/videos/chapters/${chapterId}/videos/reorder`, { method: 'PATCH', body: JSON.stringify({ items }) }),
  uploadVideoPdf: (videoId: string, file: File, onProgress?: (percent: number) => void) =>
    uploadFetcherWithProgress<Video>(`/videos/items/${videoId}/pdf`, file, onProgress),
  deleteVideoPdf: (videoId: string) => fetcher<Video>(`/videos/items/${videoId}/pdf`, { method: 'DELETE' }),

  // PDF Library (Exam → Chapter → PDF)
  getPdfExams: () => fetcher<PdfExam[]>('/pdfs/exams'),
  getPdfExam: (examId: string) => fetcher<PdfExam>(`/pdfs/exams/${examId}`),
  createPdfExam: (payload: LibraryFolderPayload) =>
    fetcher<PdfExam>('/pdfs/exams', { method: 'POST', body: JSON.stringify(payload) }),
  updatePdfExam: (examId: string, payload: Partial<LibraryFolderPayload>) =>
    fetcher<PdfExam>(`/pdfs/exams/${examId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deletePdfExam: (examId: string) => fetcher<any>(`/pdfs/exams/${examId}`, { method: 'DELETE' }),
  reorderPdfExams: (items: ReorderEntry[]) =>
    fetcher<PdfExam[]>('/pdfs/exams/reorder', { method: 'PATCH', body: JSON.stringify({ items }) }),

  getPdfChapters: (examId: string) => fetcher<PdfChapter[]>(`/pdfs/exams/${examId}/chapters`),
  getPdfChapter: (chapterId: string) => fetcher<PdfChapter>(`/pdfs/chapters/${chapterId}`),
  createPdfChapter: (examId: string, payload: LibraryFolderPayload) =>
    fetcher<PdfChapter>(`/pdfs/exams/${examId}/chapters`, { method: 'POST', body: JSON.stringify(payload) }),
  updatePdfChapter: (chapterId: string, payload: Partial<LibraryFolderPayload>) =>
    fetcher<PdfChapter>(`/pdfs/chapters/${chapterId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deletePdfChapter: (chapterId: string) => fetcher<any>(`/pdfs/chapters/${chapterId}`, { method: 'DELETE' }),
  reorderPdfChapters: (examId: string, items: ReorderEntry[]) =>
    fetcher<PdfChapter[]>(`/pdfs/exams/${examId}/chapters/reorder`, { method: 'PATCH', body: JSON.stringify({ items }) }),

  getPdfDocuments: (chapterId: string) => fetcher<PdfDocument[]>(`/pdfs/chapters/${chapterId}/documents`),
  createPdfDocument: (chapterId: string, payload: PdfDocumentWritePayload) =>
    fetcher<PdfDocument>(`/pdfs/chapters/${chapterId}/documents`, { method: 'POST', body: JSON.stringify(payload) }),
  updatePdfDocument: (documentId: string, payload: Partial<PdfDocumentWritePayload>) =>
    fetcher<PdfDocument>(`/pdfs/documents/${documentId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deletePdfDocument: (documentId: string) => fetcher<any>(`/pdfs/documents/${documentId}`, { method: 'DELETE' }),
  reorderPdfDocuments: (chapterId: string, items: ReorderEntry[]) =>
    fetcher<PdfDocument[]>(`/pdfs/chapters/${chapterId}/documents/reorder`, { method: 'PATCH', body: JSON.stringify({ items }) }),
  /** Study-material PDFs are large enough that the admin form shows a progress bar while this runs. */
  uploadPdfDocumentFile: (documentId: string, file: File, onProgress?: (percent: number) => void) =>
    uploadFetcherWithProgress<PdfDocument>(`/pdfs/documents/${documentId}/file`, file, onProgress),

  // Library (reading progress)
  getReadingProgress: (bookId: string) => fetcher<ReadingProgress[]>(`/library/progress?bookId=${bookId}`),
  upsertReadingProgress: (payload: { bookId: string; chapterId?: string; topicId?: string; progressPercent: number }) =>
    fetcher<ReadingProgress>('/library/progress', { method: 'POST', body: JSON.stringify(payload) }),

  // Quizzes
  getQuizzes: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    folder?: string;
    access?: string;
    status?: string;
    publishedOnly?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.folder && params.folder !== 'ALL') q.set('folder', params.folder);
    if (params?.access && params.access !== 'ALL') q.set('access', params.access);
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.publishedOnly) q.set('publishedOnly', 'true');
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetcher<any>(`/quizzes${qs}`);
  },
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

  getQuizFolders: () => fetcher<QuizFolder[]>('/quizzes/folders'),
  createQuizFolder: (payload: QuizFolderWritePayload) =>
    fetcher<QuizFolder>('/quizzes/folders', { method: 'POST', body: JSON.stringify(payload) }),
  updateQuizFolder: (id: string, payload: Partial<QuizFolderWritePayload>) =>
    fetcher<QuizFolder>(`/quizzes/folders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteQuizFolder: (id: string) => fetcher<any>(`/quizzes/folders/${id}`, { method: 'DELETE' }),
  reorderQuizFolders: (items: ReorderEntry[]) =>
    fetcher<QuizFolder[]>('/quizzes/folders/reorder', { method: 'PATCH', body: JSON.stringify({ items }) }),

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
  getAllOrders: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.status && params.status !== 'ALL') q.set('status', params.status);
    if (params?.type && params.type !== 'ALL') q.set('type', params.type);
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetcher<any>(`/orders${qs}`);
  },
  getUserOrders: (userId: string) => fetcher<any[]>(`/orders/user/${userId}`),
  updateOrder: (id: string, payload: { status?: string; amount?: number; description?: string; razorpayPaymentId?: string }) =>
    fetcher<Order>(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  createManualOrder: (payload: { userId: string; bookId?: string; quizId?: string; amount?: number; note?: string }) =>
    fetcher<Order>(`/orders/manual`, { method: 'POST', body: JSON.stringify(payload) }),
  /**
   * Checks a coupon before checkout. The server is still the authority — it
   * re-applies the discount when the order is created — so this only exists to
   * show the student the price they will actually be charged.
   */
  validateCoupon: (code: string) =>
    fetcher<{
      id: string;
      code: string;
      discountPercent: number;
      maxDiscountAmount: number;
      validTill: string;
      isActive: boolean;
    }>(`/coupons/validate?code=${encodeURIComponent(code)}`),
  getMyOrders: () => fetcher<OrderWithItems[]>('/orders/me'),

  // Coupons (Admin)
  getCoupons: () => fetcher<Coupon[]>('/coupons'),
  createCoupon: (payload: { code: string; discountPercent: number; maxDiscountAmount: number; validTill: string; isActive?: boolean }) =>
    fetcher<Coupon>('/coupons', { method: 'POST', body: JSON.stringify(payload) }),
  updateCoupon: (
    id: string,
    payload: Partial<{ code: string; discountPercent: number; maxDiscountAmount: number; validTill: string; isActive: boolean }>,
  ) => fetcher<Coupon>(`/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  setCouponActive: (id: string, isActive: boolean) =>
    fetcher<Coupon>(`/coupons/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  deleteCoupon: (id: string) => fetcher<any>(`/coupons/${id}`, { method: 'DELETE' }),

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

  // --- Staff Management ---
  getStaff: (params?: { search?: string; role?: string; status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.role) qs.set('role', params.role);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return fetcher<{ data: StaffMember[]; meta: { total: number; page: number; limit: number; totalPages: number } }>(
      `/staff${suffix}`,
    );
  },
  createStaff: (data: any) =>
    fetcher<{ user: StaffMember; generatedPassword?: string }>('/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateStaff: (id: string, data: any) =>
    fetcher<StaffMember>(`/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  updateStaffPermissions: (id: string, permissions: Partial<StaffPermission>) =>
    fetcher<StaffPermission>(`/staff/${id}/permissions`, {
      method: 'PATCH',
      body: JSON.stringify(permissions),
    }),
  resetStaffPassword: (id: string, password: string) =>
    fetcher<{ success: boolean; password: string }>(`/staff/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  suspendStaff: (id: string) =>
    fetcher(`/staff/${id}/suspend`, { method: 'PATCH' }),
  reactivateStaff: (id: string) =>
    fetcher(`/staff/${id}/reactivate`, { method: 'PATCH' }),
  deleteStaff: (id: string) =>
    fetcher(`/staff/${id}`, { method: 'DELETE' }),
};
