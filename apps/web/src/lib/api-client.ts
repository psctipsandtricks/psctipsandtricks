import {
  Book,
  BookSubscriptionType,
  BookSubscriptionDuration,
  BookReaderContent,
  Chapter,
  Topic,
  Subtopic,
  PdfSyncMap,
  ReadingProgress,
  Quiz,
  QuizAttemptSummary,
  QuizSubmissionPayload,
  QuizResult,
  QuizAttempt,
  QuizAttemptReview,
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
  VideoFolder,
  VideoExam,
  VideoChapter,
  Video,
  PdfFolder,
  PdfExam,
  PdfChapter,
  PdfDocument,
  QuizFolder,
  StaffMember,
  StaffPermission,
  AnnouncementPopup,
  Notification as AppNotification,
  SentNotification,
  PushStatus,
  CustomerReview,
  SocialLinks,
  AppUpdateConfig,
} from '@psc/shared-types';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

/** Book fields an admin can write. `finalPrice` is intentionally absent — the server derives it from price + discountPercent. */
export interface BookWritePayload {
  title: string;
  author: string;
  description: string;
  category: string;
  price: number;
  discountPercent?: number;
  publicationYear?: number;
  productId?: string;
  appleId?: string;
  basePlanId?: string;
  subscriptionType?: BookSubscriptionType;
  subscriptionDuration?: BookSubscriptionDuration | string | null;
  isPremium?: boolean;
  isPublished?: boolean;
  visibleToGuests?: boolean;
  heroCoverUrl?: string | null;
  previewPdfUrl?: string;
  previewPdfFileName?: string;
  previewPdfSizeBytes?: number;
  previewAudioUrl?: string;
  previewAudioFileName?: string;
  previewAudioSizeBytes?: number;
}

/** Fields an admin writes on an exam or chapter folder, in either content library. */
export interface LibraryFolderPayload {
  title: string;
  description?: string;
  orderIndex?: number;
  isActive?: boolean;
}

export interface VideoFolderWritePayload {
  name: string;
  parentId?: string | null;
  description?: string | null;
  orderIndex?: number;
  isActive?: boolean;
}

export interface PdfFolderWritePayload {
  name: string;
  parentId?: string | null;
  description?: string | null;
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
  folderId?: string;
  chapterId?: string;
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
  parentId?: string | null;
  description?: string;
  orderIndex?: number;
  isActive?: boolean;
}

/** A home-page testimonial. Written by an admin on a customer's behalf. */
export interface ReviewWritePayload {
  customerName: string;
  rating: number;
  comment: string;
  isActive?: boolean;
  orderIndex?: number;
}

/** The file itself goes through `uploadPdfDocumentFile`, not this payload. */
export interface PdfDocumentWritePayload {
  folderId?: string;
  chapterId?: string;
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
  const preferredKey = isAdminContext() ? ADMIN_ACCESS_TOKEN_KEY : STUDENT_ACCESS_TOKEN_KEY;
  const fallbackKey = isAdminContext() ? STUDENT_ACCESS_TOKEN_KEY : ADMIN_ACCESS_TOKEN_KEY;
  return localStorage.getItem(preferredKey) || localStorage.getItem(fallbackKey);
}

// Deduped in-flight refresh: concurrent 401s on the same session share one
// /auth/refresh call. Student and admin sessions get independent promises so
// a refresh on one surface can never be satisfied with the other's token.
let studentRefreshPromise: Promise<string | null> | null = null;
let adminRefreshPromise: Promise<string | null> | null = null;

async function tryRefreshAccessToken(admin: boolean): Promise<string | null> {
  let accessKey = admin ? ADMIN_ACCESS_TOKEN_KEY : STUDENT_ACCESS_TOKEN_KEY;
  let refreshKey = admin ? ADMIN_REFRESH_TOKEN_KEY : STUDENT_REFRESH_TOKEN_KEY;
  let refreshToken = typeof window !== 'undefined' ? localStorage.getItem(refreshKey) : null;
  if (!refreshToken && typeof window !== 'undefined') {
    const fallbackRefreshKey = admin ? STUDENT_REFRESH_TOKEN_KEY : ADMIN_REFRESH_TOKEN_KEY;
    const fallbackAccessKey = admin ? STUDENT_ACCESS_TOKEN_KEY : ADMIN_ACCESS_TOKEN_KEY;
    const fallbackToken = localStorage.getItem(fallbackRefreshKey);
    if (fallbackToken) {
      accessKey = fallbackAccessKey;
      refreshKey = fallbackRefreshKey;
      refreshToken = fallbackToken;
    }
  }

  const existing = admin ? adminRefreshPromise : studentRefreshPromise;

  const promise =
    existing ||
    (async () => {
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
  sendRegisterOtp: (data: { name: string; email: string; password: string; phoneNumber?: string }) =>
    fetcher<{ success: boolean; requiresOtp: boolean; email: string; message: string }>('/auth/send-register-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  verifyRegisterOtp: (data: { email: string; otp: string }) =>
    fetcher<AuthResponse>('/auth/verify-register-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  forgotPassword: (data: { email: string }) =>
    fetcher<{ success: boolean; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  adminForgotPassword: (data: { email: string }) =>
    fetcher<{ success: boolean; message: string }>('/auth/admin/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  verifyOtp: (data: { email: string; otp: string }) =>
    fetcher<{ success: boolean; message: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  resetPassword: (data: { email: string; otp: string; newPassword: string }) =>
    fetcher<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
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
  uploadBookHeroCover: (id: string, file: File) => uploadFetcher<Book>(`/books/${id}/hero-cover`, file),
  deleteBookHeroCover: (id: string) => fetcher<Book>(`/books/${id}/hero-cover`, { method: 'DELETE' }),
  uploadBookPreviewPdf: (id: string, file: File, onProgress?: (percent: number) => void) =>
    uploadFetcherWithProgress<Book>(`/books/${id}/preview-pdf`, file, onProgress),
  deleteBookPreviewPdf: (id: string) => fetcher<Book>(`/books/${id}/preview-pdf`, { method: 'DELETE' }),
  uploadBookPreviewAudio: (id: string, file: File, onProgress?: (percent: number) => void) =>
    uploadFetcherWithProgress<Book>(`/books/${id}/preview-audio`, file, onProgress),
  deleteBookPreviewAudio: (id: string) => fetcher<Book>(`/books/${id}/preview-audio`, { method: 'DELETE' }),

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
    syncCues: PdfSyncMap;
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
    syncCues: PdfSyncMap;
  }>) => fetcher<Subtopic>(`/books/subtopics/${subtopicId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSubtopic: (subtopicId: string) => fetcher<any>(`/books/subtopics/${subtopicId}`, { method: 'DELETE' }),
  reorderSubtopics: (topicId: string, subtopics: { id: string; orderIndex: number }[]) =>
    fetcher<Subtopic[]>(`/books/topics/${topicId}/subtopics/reorder`, { method: 'PATCH', body: JSON.stringify({ subtopics }) }),
  uploadSubtopicAudio: (subtopicId: string, file: File) => uploadFetcher<Subtopic>(`/books/subtopics/${subtopicId}/audio`, file),
  uploadSubtopicPdf: (subtopicId: string, file: File) => uploadFetcher<Subtopic>(`/books/subtopics/${subtopicId}/pdf`, file),

  // Video Library (Folders & Multi-level Subfolders)
  getVideoFolders: (parentId?: string | null) => {
    const q = parentId !== undefined && parentId !== null ? `?parentId=${encodeURIComponent(parentId)}` : '';
    return fetcher<VideoFolder[]>(`/videos/folders${q}`);
  },
  getVideoFolder: (id: string) =>
    fetcher<VideoFolder & { breadcrumbs: { id: string; name: string }[]; children: VideoFolder[]; videos: Video[] }>(`/videos/folders/${id}`),
  createVideoFolder: (payload: VideoFolderWritePayload) =>
    fetcher<VideoFolder>('/videos/folders', { method: 'POST', body: JSON.stringify(payload) }),
  updateVideoFolder: (id: string, payload: Partial<VideoFolderWritePayload>) =>
    fetcher<VideoFolder>(`/videos/folders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteVideoFolder: (id: string) => fetcher<any>(`/videos/folders/${id}`, { method: 'DELETE' }),
  reorderVideoFolders: (items: ReorderEntry[]) =>
    fetcher<VideoFolder[]>('/videos/folders/reorder', { method: 'PATCH', body: JSON.stringify({ items }) }),

  getVideos: (params?: { folderId?: string; chapterId?: string; search?: string } | string) => {
    let q = '';
    if (typeof params === 'string') {
      q = `?chapterId=${encodeURIComponent(params)}`;
    } else if (params) {
      const searchParams = new URLSearchParams();
      if (params.folderId) searchParams.set('folderId', params.folderId);
      if (params.chapterId) searchParams.set('chapterId', params.chapterId);
      if (params.search) searchParams.set('search', params.search);
      const str = searchParams.toString();
      if (str) q = `?${str}`;
    }
    return fetcher<Video[]>(`/videos${q}`);
  },
  getVideo: (id: string) => fetcher<Video>(`/videos/${id}`),
  createVideo: (payload: VideoWritePayload | string, secondPayload?: VideoWritePayload) => {
    const body = typeof payload === 'string' ? { ...secondPayload, chapterId: payload } : payload;
    return fetcher<Video>('/videos', { method: 'POST', body: JSON.stringify(body) });
  },
  updateVideo: (videoId: string, payload: Partial<VideoWritePayload>) =>
    fetcher<Video>(`/videos/${videoId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteVideo: (videoId: string) => fetcher<any>(`/videos/${videoId}`, { method: 'DELETE' }),
  uploadVideoPdf: (videoId: string, file: File, onProgress?: (percent: number) => void) =>
    uploadFetcherWithProgress<Video>(`/videos/${videoId}/pdf`, file, onProgress),
  deleteVideoPdf: (videoId: string) => fetcher<Video>(`/videos/${videoId}/pdf`, { method: 'DELETE' }),
  reorderVideos: (chapterIdOrItems: string | ReorderEntry[], items?: ReorderEntry[]) => {
    const list = Array.isArray(chapterIdOrItems) ? chapterIdOrItems : items || [];
    return fetcher<any>('/videos/folders/reorder', { method: 'PATCH', body: JSON.stringify({ items: list }) });
  },

  // Legacy Video Exam & Chapter Compatibility Methods
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

  // PDF Library (Folders & Multi-level Subfolders)
  getPdfFolders: (parentId?: string | null) => {
    const q = parentId !== undefined && parentId !== null ? `?parentId=${encodeURIComponent(parentId)}` : '';
    return fetcher<PdfFolder[]>(`/pdfs/folders${q}`);
  },
  getPdfFolder: (id: string) =>
    fetcher<PdfFolder & { breadcrumbs: { id: string; name: string }[]; children: PdfFolder[]; documents: PdfDocument[] }>(`/pdfs/folders/${id}`),
  createPdfFolder: (payload: PdfFolderWritePayload) =>
    fetcher<PdfFolder>('/pdfs/folders', { method: 'POST', body: JSON.stringify(payload) }),
  updatePdfFolder: (id: string, payload: Partial<PdfFolderWritePayload>) =>
    fetcher<PdfFolder>(`/pdfs/folders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deletePdfFolder: (id: string) => fetcher<any>(`/pdfs/folders/${id}`, { method: 'DELETE' }),
  reorderPdfFolders: (items: ReorderEntry[]) =>
    fetcher<PdfFolder[]>('/pdfs/folders/reorder', { method: 'PATCH', body: JSON.stringify({ items }) }),

  getPdfDocuments: (params?: { folderId?: string; chapterId?: string; search?: string } | string) => {
    let q = '';
    if (typeof params === 'string') {
      q = `?chapterId=${encodeURIComponent(params)}`;
    } else if (params) {
      const searchParams = new URLSearchParams();
      if (params.folderId) searchParams.set('folderId', params.folderId);
      if (params.chapterId) searchParams.set('chapterId', params.chapterId);
      if (params.search) searchParams.set('search', params.search);
      const str = searchParams.toString();
      if (str) q = `?${str}`;
    }
    return fetcher<PdfDocument[]>(`/pdfs${q}`);
  },
  getPdfDocument: (id: string) => fetcher<PdfDocument>(`/pdfs/${id}`),
  createPdfDocument: (payload: PdfDocumentWritePayload | string, secondPayload?: PdfDocumentWritePayload) => {
    const body = typeof payload === 'string' ? { ...secondPayload, chapterId: payload } : payload;
    return fetcher<PdfDocument>('/pdfs', { method: 'POST', body: JSON.stringify(body) });
  },
  updatePdfDocument: (documentId: string, payload: Partial<PdfDocumentWritePayload>) =>
    fetcher<PdfDocument>(`/pdfs/${documentId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deletePdfDocument: (documentId: string) => fetcher<any>(`/pdfs/${documentId}`, { method: 'DELETE' }),
  uploadPdfDocumentFile: (documentId: string, file: File, onProgress?: (percent: number) => void) =>
    uploadFetcherWithProgress<PdfDocument>(`/pdfs/${documentId}/file`, file, onProgress),
  deletePdfDocumentFile: (documentId: string) => fetcher<any>(`/pdfs/${documentId}/file`, { method: 'DELETE' }),
  reorderPdfDocuments: (chapterIdOrItems: string | ReorderEntry[], items?: ReorderEntry[]) => {
    const list = Array.isArray(chapterIdOrItems) ? chapterIdOrItems : items || [];
    return fetcher<any>('/pdfs/folders/reorder', { method: 'PATCH', body: JSON.stringify({ items: list }) });
  },

  // Legacy PDF Exam & Chapter Compatibility Methods
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
  /**
   * The published catalog, narrowed server-side.
   *
   * The Quiz Hub asks for one folder at a time rather than the whole catalog:
   * folders carry their own counts, so nothing needs every quiz in memory just
   * to decide what to draw. `folder: 'Root'` means the quizzes filed nowhere.
   */
  getPublishedQuizzesWhere: (params: {
    folder?: string;
    search?: string;
    access?: 'FREE' | 'PAID';
    sort?: 'newest';
    limit?: number;
  }) => {
    const q = new URLSearchParams({ publishedOnly: 'true' });
    if (params.folder) q.set('folder', params.folder);
    if (params.search?.trim()) q.set('search', params.search.trim());
    if (params.access) q.set('access', params.access);
    if (params.sort) q.set('sort', params.sort);
    if (params.limit) q.set('limit', String(params.limit));
    return fetcher<Quiz[] | { data: Quiz[] }>(`/quizzes?${q.toString()}`).then((res) =>
      // `limit` switches the API to its paginated envelope; without it the
      // response is a bare array.
      Array.isArray(res) ? res : res.data ?? [],
    );
  },
  /**
   * How many published quizzes exist in one access tier, without downloading
   * them. The paginated envelope carries `total`, so a single-row page answers
   * the hub's headline counts for the price of one quiz.
   */
  getPublishedQuizCount: (access: 'FREE' | 'PAID') =>
    fetcher<{ total?: number }>(
      `/quizzes?publishedOnly=true&access=${access}&page=1&limit=1`,
    ).then((res) => res?.total ?? 0),
  getQuizById: (id: string) => fetcher<Quiz>(`/quizzes/${id}`),
  createQuiz: (payload: any) =>
    fetcher<any>('/quizzes', { method: 'POST', body: JSON.stringify(payload) }),
  updateQuiz: (id: string, payload: any) =>
    fetcher<any>(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteQuiz: (id: string) =>
    fetcher<any>(`/quizzes/${id}`, { method: 'DELETE' }),
  uploadQuizImage: (file: File) => uploadFetcher<{ url: string }>('/quizzes/upload-image', file),
  uploadQuizImageForId: (id: string, file: File) => uploadFetcher<{ url: string; quiz: Quiz }>(`/quizzes/${id}/image`, file),
  removeQuizImage: (id: string) => fetcher<Quiz>(`/quizzes/${id}/image`, { method: 'DELETE' }),
  submitQuiz: (id: string, payload: QuizSubmissionPayload) =>
    fetcher<QuizResult>(`/quizzes/${id}/submit`, { method: 'POST', body: JSON.stringify(payload) }),
  /**
   * Opens the attempt: resumes an unfinished one, or begins a new one when
   * there is nothing to resume. `restart` is "Start from beginning" — it
   * retires the unfinished attempt and starts again at question one.
   */
  startQuizAttempt: (quizId: string, options?: { restart?: boolean }) =>
    fetcher<any>(
      `/quizzes/${quizId}/attempts/start${options?.restart ? '?restart=true' : ''}`,
      { method: 'POST' },
    ),
  /**
   * Completed and in-progress attempts per quiz, for this student. Drives the
   * Start / Resume / Retake button and the attempt count on every quiz card.
   */
  getQuizAttemptSummary: () =>
    fetcher<QuizAttemptSummary[]>('/quizzes/attempts/summary'),
  getActiveQuizAttempt: (quizId: string) => fetcher<any>(`/quizzes/${quizId}/attempts/active`),
  pauseQuizAttempt: (
    quizId: string,
    payload: { timeTakenSeconds: number; answers: any[]; currentIndex?: number },
    attemptId?: string
  ) =>
    fetcher<any>(`/quizzes/${quizId}/attempts/pause${attemptId ? `?attemptId=${attemptId}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  /** Resolves to the persisted attempt — its `id` addresses the review page. */
  submitQuizAttempt: (quizId: string, payload: QuizSubmissionPayload, attemptId?: string) =>
    fetcher<QuizAttempt>(`/quizzes/${quizId}/submit${attemptId ? `?attemptId=${attemptId}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getStudentAttemptHistory: () => fetcher<any[]>('/quizzes/history/me'),
  /** Question-by-question review of one submitted attempt — the shared result payload. */
  getQuizAttemptReview: (attemptId: string) =>
    fetcher<QuizAttemptReview>(`/quizzes/attempts/${attemptId}/review`),
  getMyDashboard: () => fetcher<StudentDashboard>('/analytics/me/dashboard'),

  getQuizFolders: (parentId?: string | null) => {
    const q = parentId !== undefined && parentId !== null ? `?parentId=${encodeURIComponent(parentId)}` : '';
    return fetcher<QuizFolder[]>(`/quizzes/folders${q}`);
  },
  createQuizFolder: (payload: QuizFolderWritePayload) =>
    fetcher<QuizFolder>('/quizzes/folders', { method: 'POST', body: JSON.stringify(payload) }),
  updateQuizFolder: (id: string, payload: Partial<QuizFolderWritePayload>) =>
    fetcher<QuizFolder>(`/quizzes/folders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteQuizFolder: (id: string) => fetcher<any>(`/quizzes/folders/${id}`, { method: 'DELETE' }),
  reorderQuizFolders: (items: ReorderEntry[]) =>
    fetcher<QuizFolder[]>('/quizzes/folders/reorder', { method: 'PATCH', body: JSON.stringify({ items }) }),

  /**
   * Positions are absolute within the folder, not indices on the current page:
   * the admin quiz table is paginated server-side, so the client is the only
   * side that knows the page offset to add.
   */
  reorderQuizzes: (items: ReorderEntry[]) =>
    fetcher<{ success: boolean; updated: number }>('/quizzes/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    }),

  /**
   * Moves one quiz to a zero-based position in its folder, shifting the rest.
   * Used by "Move to Position" and the Up/Down buttons, which can send a quiz
   * to a page the admin isn't currently looking at.
   */
  moveQuiz: (id: string, position: number) =>
    fetcher<{ success: boolean; position: number }>(`/quizzes/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ position }),
    }),

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
  updateOrder: (
    id: string,
    payload: {
      status?: string;
      amount?: number;
      description?: string;
      razorpayPaymentId?: string;
      purchaseDate?: string;
      orderDate?: string;
      createdAt?: string;
    },
  ) => fetcher<Order>(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  createManualOrder: (payload: {
    userId: string;
    bookId?: string;
    quizId?: string;
    amount?: number;
    note?: string;
    purchaseDate?: string;
    orderDate?: string;
    createdAt?: string;
  }) => fetcher<Order>(`/orders/manual`, { method: 'POST', body: JSON.stringify(payload) }),
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

  // Customer Reviews
  /** Public — only the reviews an admin has enabled, in the admin-chosen order. */
  getActiveReviews: () => fetcher<CustomerReview[]>('/reviews/active'),
  getReviews: () => fetcher<CustomerReview[]>('/reviews'),
  createReview: (payload: ReviewWritePayload) =>
    fetcher<CustomerReview>('/reviews', { method: 'POST', body: JSON.stringify(payload) }),
  updateReview: (id: string, payload: Partial<ReviewWritePayload>) =>
    fetcher<CustomerReview>(`/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  setReviewActive: (id: string, isActive: boolean) =>
    fetcher<CustomerReview>(`/reviews/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  deleteReview: (id: string) => fetcher<any>(`/reviews/${id}`, { method: 'DELETE' }),

  // Social Links
  /** Public — used by both the home page and the admin settings form. */
  getSocialLinks: () => fetcher<SocialLinks>('/social-links'),
  updateSocialLinks: (payload: {
    telegramUrl?: string;
    instagramUrl?: string;
    youtubeUrl?: string;
    facebookUrl?: string;
    twitterUrl?: string;
    playStoreUrl?: string;
    appStoreUrl?: string;
  }) =>
    fetcher<SocialLinks>('/social-links', { method: 'PATCH', body: JSON.stringify(payload) }),

  // App Update Settings
  /** Public — same endpoint the mobile app calls on launch; the admin form uses it to prefill. Android-only for now. */
  getAppUpdateConfig: () => fetcher<AppUpdateConfig>('/app/update-config?platform=android'),
  updateAppUpdateConfig: (payload: {
    enabled?: boolean;
    updateMode?: AppUpdateConfig['updateMode'];
    minimumVersion?: string;
    latestVersion?: string;
    forceUpdate?: boolean;
    message?: string;
  }) => fetcher<AppUpdateConfig>('/app/update-config', { method: 'PATCH', body: JSON.stringify({ platform: 'android', ...payload }) }),

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

  // --- Notifications (signed-in student's own inbox) ---
  /**
   * The newest 100 notifications addressed to this student, plus every
   * broadcast. Ordered newest first; the caller applies its own retention rule.
   */
  getMyNotifications: () => fetcher<AppNotification[]>('/notifications'),
  /**
   * Persists read state for one notification, for this student on every device.
   * Broadcasts included: the server keeps a per-student receipt rather than a
   * flag on the shared row, so a notice read here is read in the phone app too.
   */
  markNotificationRead: (id: string) =>
    fetcher<{ id: string; isRead: boolean; perUser: boolean }>(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),
  /**
   * Marks many at once — one request for "mark all as read" instead of one per
   * notice. Omitting `ids` marks everything the student can currently see.
   */
  markNotificationsRead: (ids?: string[]) =>
    fetcher<{ count: number; ids: string[] }>('/notifications/read', {
      method: 'POST',
      body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
    }),

  // --- Push Notifications (Admin / Staff with manage_notifications) ---
  /**
   * Saves the notification and queues it for FCM delivery. Returns as soon as
   * the row is written — delivery happens on the API's queue behind it.
   */
  sendNotification: (payload: {
    title: string;
    body: string;
    /** Omit for a broadcast to every student. */
    userId?: string;
    type?: string;
    route?: string;
    imageUrl?: string;
    scheduledFor?: string;
  }) => fetcher<AppNotification>('/notifications/send', { method: 'POST', body: JSON.stringify(payload) }),
  uploadNotificationImage: (file: File) =>
    uploadFetcher<{ url: string }>('/notifications/image', file),
  listSentNotifications: (limit = 100) =>
    fetcher<SentNotification[]>(`/notifications/sent?limit=${limit}`),
  deleteNotification: (id: string) =>
    fetcher<{ id: string }>(`/notifications/${id}`, { method: 'DELETE' }),
  getPushStatus: () => fetcher<PushStatus>('/notifications/push-status'),

  // --- Announcement Banner (Admin / Staff with manage_announcements) ---
  listAnnouncements: () => fetcher<AnnouncementPopup[]>('/notifications/announcements'),
  getActiveAnnouncements: () => fetcher<AnnouncementPopup[]>('/notifications/announcements/active'),
  createAnnouncement: (payload: {
    title: string;
    message: string;
    imageUrl?: string | null;
    buttonText?: string | null;
    redirectUrl?: string | null;
    backgroundColor?: string | null;
    isActive?: boolean;
    orderIndex?: number;
    startDate?: string;
    endDate: string;
  }) => fetcher<AnnouncementPopup>('/notifications/announcements', { method: 'POST', body: JSON.stringify(payload) }),
  updateAnnouncement: (
    id: string,
    payload: Partial<{
      title: string;
      message: string;
      imageUrl: string | null;
      buttonText: string | null;
      redirectUrl: string | null;
      backgroundColor: string | null;
      isActive: boolean;
      orderIndex: number;
      startDate: string;
      endDate: string;
    }>,
  ) => fetcher<AnnouncementPopup>(`/notifications/announcements/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  reorderAnnouncements: (ids: string[]) =>
    fetcher<AnnouncementPopup[]>('/notifications/announcements/reorder', {
      method: 'PATCH',
      body: JSON.stringify({ ids }),
    }),
  deleteAnnouncement: (id: string) =>
    fetcher<{ success?: boolean }>(`/notifications/announcements/${id}`, { method: 'DELETE' }),
  uploadAnnouncementBannerImage: (file: File) =>
    uploadFetcher<{ url: string }>('/notifications/announcements/banner-image', file),
};
