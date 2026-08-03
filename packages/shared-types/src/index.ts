export type UserRole = 'STUDENT' | 'ADMIN' | 'TEACHER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isPremium: boolean;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  pdfUrl?: string;
  price: number;
  category: string;
  isPublished: boolean;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  quizId?: string;
  text: string;
  options: QuestionOption[];
  correctOptionIndex: number;
  explanation?: string | null;
  marks: number;
}

export interface Quiz {
  id: string;
  title: string;
  category: string;
  description: string;
  totalQuestions: number;
  durationMinutes: number;
  isLiveMock: boolean;
  passingMarks: number;
  totalMarks: number;
  questions?: Question[];
  createdAt: string;
  updatedAt: string;
}

export interface QuizSubmissionPayload {
  quizId: string;
  answers: { questionId: string; selectedOptionIndex: number }[];
  timeTakenSeconds: number;
}

export interface QuizResult {
  submissionId: string;
  quizId: string;
  userId: string;
  score: number;
  totalMarks: number;
  passed: boolean;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  timeTakenSeconds: number;
  rank?: number;
  createdAt: string;
}

export type OrderStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface Order {
  id: string;
  userId: string;
  bookId?: string | null;
  quizId?: string | null;
  amount: number;
  currency: string;
  status: OrderStatus;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountPercent: number;
  maxDiscountAmount: number;
  validTill: string;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  content: string;
  room: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  userId?: string | null;
  isRead: boolean;
  type?: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  score: number;
  timeTakenSeconds: number;
}

export interface AuthPayload {
  email: string;
  sub: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  key: string;
}
