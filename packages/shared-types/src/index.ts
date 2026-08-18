export type UserRole = 'STUDENT' | 'STAFF' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  isPremium: boolean;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The signed-in user's own profile, as returned by GET /users/:id. */
export interface UserProfile extends User {
  oauthIdentities: { provider: 'GOOGLE' | 'APPLE' }[];
  ordersCount: number;
  quizAttemptsCount: number;
  /** Photo from the user's linked Google account, if any — kept fresh on each Google sign-in. */
  googleAvatarUrl?: string | null;
}

export interface StaffPermission {
  id: string;
  userId: string;
  manageBooks: boolean;
  manageQuizzes: boolean;
  manageChat: boolean;
  manageCoupons: boolean;
  manageNotifications: boolean;
  viewOrders: boolean;
  manageOrders: boolean;
  viewAnalytics: boolean;
  manageUsers: boolean;
  manageVideos: boolean;
  managePdfs: boolean;
  manageStaff: boolean;
  manageAnnouncements: boolean;
  grantedById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  role: 'ADMIN' | 'STAFF' | 'STUDENT';
  status: 'ACTIVE' | 'SUSPENDED';
  avatarUrl?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  staffPermission?: StaffPermission | null;
}

export type BookSubscriptionType = 'FULL_TIME_ACCESS' | 'LIMITED_ACCESS' | 'SUBSCRIPTION';

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  pdfUrl?: string;
  previewPdfUrl?: string | null;
  previewPdfFileName?: string | null;
  previewPdfSizeBytes?: number | null;
  price: number;
  discountPercent: number;
  /** Effective charged price — always price minus discountPercent, computed server-side. */
  finalPrice: number;
  category: string;
  publicationYear?: number | null;
  productId?: string | null;
  appleId?: string | null;
  basePlanId?: string | null;
  subscriptionType: BookSubscriptionType;
  isPremium: boolean;
  isPublished: boolean;
  visibleToGuests: boolean;
  downloadCount: number;
  ordersCount?: number;
  chaptersCount?: number;
  topicsCount?: number;
  chapters?: Chapter[];
  /** Present on responses from GET /books and GET /books/:id — the caller's purchase state for this book. */
  access?: {
    isPaid: boolean;
    hasAccess: boolean;
    price: number;
    reason: 'FREE' | 'PURCHASED' | 'STAFF' | 'LOGIN_REQUIRED' | 'PAYMENT_REQUIRED';
  };
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  bookId: string;
  title: string;
  description?: string | null;
  orderIndex: number;
  isActive: boolean;
  textContent?: string | null;
  youtubeUrl?: string | null;
  audioUrl?: string | null;
  audioDurationSeconds?: number | null;
  pdfUrl?: string | null;
  topicsCount?: number;
  topics?: Topic[];
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  id: string;
  chapterId: string;
  title: string;
  description?: string | null;
  orderIndex: number;
  isActive: boolean;
  youtubeUrl?: string | null;
  audioUrl?: string | null;
  pdfUrl?: string | null;
  subtopicsCount?: number;
  subtopics?: Subtopic[];
  createdAt: string;
  updatedAt: string;
}

export interface Subtopic {
  id: string;
  topicId: string;
  title: string;
  description?: string | null;
  orderIndex: number;
  isActive: boolean;
  youtubeUrl?: string | null;
  audioUrl?: string | null;
  pdfUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- YouTube video library (Exam → Chapter → Video) ---

/** Shared shape of the two library folder levels — exams and chapters differ only in what they contain. */
export interface LibraryFolder {
  id: string;
  title: string;
  description?: string | null;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VideoExam extends LibraryFolder {
  /** Number of videos across every chapter — present on list responses so a folder card can show how much is inside. */
  videoCount?: number;
  chapterCount?: number;
  chapters?: VideoChapter[];
}

export interface VideoChapter extends LibraryFolder {
  examId: string;
  videoCount?: number;
  videos?: Video[];
}

export interface Video {
  id: string;
  chapterId: string;
  title: string;
  description?: string | null;
  youtubeUrl: string;
  youtubeVideoId: string;
  thumbnailUrl: string;
  pdfUrl?: string | null;
  pdfFileName?: string | null;
  pdfSizeBytes?: number | null;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- PDF library (Exam → Chapter → PDF) ---

export interface PdfExam extends LibraryFolder {
  documentCount?: number;
  chapterCount?: number;
  chapters?: PdfChapter[];
}

export interface PdfChapter extends LibraryFolder {
  examId: string;
  documentCount?: number;
  documents?: PdfDocument[];
}

export interface PdfDocument {
  id: string;
  chapterId: string;
  title: string;
  description?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingProgress {
  id: string;
  userId: string;
  bookId: string;
  chapterId?: string | null;
  topicId?: string | null;
  progressPercent: number;
  lastReadAt: string;
}

export interface ReaderSubtopic extends Subtopic {}

export interface ReaderTopic extends Topic {
  subtopics: ReaderSubtopic[];
}

export interface ReaderChapter extends Chapter {
  topics: ReaderTopic[];
}

export interface BookReaderContent {
  book: Pick<Book, 'id' | 'title' | 'author' | 'coverUrl' | 'category'>;
  chapters: ReaderChapter[];
}

export type BookmarkType = 'QUESTION' | 'CHAPTER';

export interface Bookmark {
  id: string;
  userId: string;
  referenceType: BookmarkType;
  referenceId: string;
  createdAt: string;
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

export interface QuizFolder {
  id: string;
  name: string;
  description?: string | null;
  orderIndex: number;
  isActive: boolean;
  quizCount?: number;
  quizzes?: Quiz[];
  createdAt: string;
  updatedAt: string;
}

export interface Quiz {
  id: string;
  title: string;
  category: string;
  folderName?: string | null;
  totalQuestions: number;
  durationMinutes: number;
  isLiveMock: boolean;
  isPremium: boolean;
  showCorrectAnswerAfterSelection?: boolean;
  price: number;
  /** "For every N wrong answers, deduct M marks" — disabled by default. */
  negativeMarkingEnabled: boolean;
  negativeMarkingEvery: number;
  negativeMarkingDeduct: number;
  /** When false (the default), the final score is floored at 0. */
  allowNegativeScore: boolean;
  passingMarks: number;
  totalMarks: number;
  questions?: Question[];
  createdAt: string;
  updatedAt: string;
}

export interface QuizSubmissionPayload {
  quizId: string;
  answers: { questionId: string; selectedOptionIndex?: number }[];
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

export type AttemptStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  attemptNumber: number;
  attemptStatus: AttemptStatus;
  score: number;
  totalMarks: number;
  percentage: number;
  totalQuestions: number;
  passed: boolean;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  timeTakenSeconds: number;
  answers: { questionId: string; selectedOptionIndex?: number }[];
  startedAt: string;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  quiz?: {
    id: string;
    title: string;
    category: string;
    durationMinutes: number;
    totalQuestions: number;
    passingMarks: number;
    totalMarks: number;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export type MockTestStatus = 'UPCOMING' | 'LIVE' | 'COMPLETED';

export interface MockTest {
  id: string;
  title: string;
  quizId: string;
  quiz?: Quiz;
  scheduledAt: string;
  status: MockTestStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface MockTestParticipant {
  id: string;
  mockTestId: string;
  userId: string;
  score?: number | null;
  rank?: number | null;
  submittedAt?: string | null;
  createdAt: string;
}

/** Payload of GET /analytics/me/dashboard — the student's personal study dashboard. */
export interface StudentDashboardAttempt {
  id: string;
  quizId: string;
  title: string;
  category: string;
  isMockTest: boolean;
  mockTestId: string | null;
  score: number;
  totalMarks: number;
  percentage: number;
  accuracy: number;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  rank: number | null;
  passed: boolean;
  timeTakenSeconds: number;
  submittedAt: string;
}

export interface StudentDashboardBookProgress {
  bookId: string;
  title: string;
  author: string;
  coverUrl: string;
  category: string;
  progressPercent: number;
  isCompleted: boolean;
  lastChapterTitle: string | null;
  lastTopicTitle: string | null;
  lastReadAt: string;
}

export interface StudentDashboard {
  stats: {
    totalAttempts: number;
    mockTestsTaken: number;
    attemptsThisWeek: number;
    averagePercent: number;
    averagePercentThisWeek: number;
    averagePercentLastWeek: number;
    accuracyPercent: number;
    bestRank: number | null;
    previousBestRank: number | null;
    rankedAttempts: number;
    studyHours: number;
    studyHoursThisWeek: number;
    passedCount: number;
    streakDays: number;
  };
  trend: { label: string; date: string; percentage: number; accuracy: number }[];
  recentAttempts: StudentDashboardAttempt[];
  subjects: { category: string; attempts: number; averagePercent: number; accuracyPercent: number | null }[];
  upcomingMockTests: {
    id: string;
    title: string;
    quizTitle: string | null;
    scheduledAt: string;
    status: MockTestStatus;
    durationMinutes: number | null;
    totalQuestions: number | null;
    totalMarks: number | null;
    participantCount: number;
    joined: boolean;
    submitted: boolean;
  }[];
  booksInProgress: StudentDashboardBookProgress[];
  generatedAt: string;
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

/** An order with the purchased item's display details attached — used for "My Orders". */
export interface OrderWithItems extends Order {
  book?: { id: string; title: string; coverUrl: string } | null;
  quiz?: { id: string; title: string; isLiveMock: boolean } | null;
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

export interface ChatGroup {
  id: string;
  name: string;
  description: string;
  category: string;
  iconEmoji: string;
  /** Group profile picture; null falls back to an initial avatar. */
  imageUrl?: string | null;
  coverGradient: string;
  isLocked: boolean;
  /** Admin switch: when false, students cannot send text messages in this group. */
  allowTextMessages: boolean;
  /** Admin switch: when false, students cannot post polls in this group. */
  allowPolls: boolean;
  type: string;
  createdAt: string;
}

export interface ChatGroupWithUserState extends ChatGroup {
  memberCount: number;
  isJoined: boolean;
  isPinned: boolean;
  unreadCount: number;
  lastReadMessageId?: string | null;
  lastMessage?: ChatMessage | null;
}

export interface ChatGroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: string;
  joinedAt: string;
}

export interface ChatGroupRead {
  id: string;
  userId: string;
  groupId: string;
  lastReadMessageId?: string | null;
  lastReadAt: string;
}

export type ChatMessageType = 'TEXT' | 'POLL' | 'IMAGE' | 'DOCUMENT';

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  content: string;
  room: string;
  groupId?: string | null;
  messageType: ChatMessageType;
  mediaUrl?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  userId?: string | null;
  target: string;
  sentById?: string | null;
  isRead: boolean;
  type?: string;
  createdAt: string;
}

export interface AnnouncementPopup {
  id: string;
  title: string;
  message: string;
  imageUrl?: string | null;
  isActive: boolean;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  score: number;
  totalMarks?: number;
  timeTakenSeconds?: number;
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
  key?: string;
  keyId?: string;
  mode?: string;
  isSimulated?: boolean;
}

export interface VerifyPaymentPayload {
  orderId: string;
  paymentId: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
}
