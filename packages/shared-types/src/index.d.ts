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
    oauthIdentities: {
        provider: 'GOOGLE' | 'APPLE';
    }[];
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
    manageReviews: boolean;
    manageSocialLinks: boolean;
    manageAppUpdate: boolean;
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
export type BookSubscriptionDuration = '1_MONTH' | '3_MONTHS' | '6_MONTHS' | '1_YEAR';
export declare const BOOK_SUBSCRIPTION_DURATIONS_LIST: readonly [{
    readonly value: "1_MONTH";
    readonly label: "1 Month";
}, {
    readonly value: "3_MONTHS";
    readonly label: "3 Months";
}, {
    readonly value: "6_MONTHS";
    readonly label: "6 Months";
}, {
    readonly value: "1_YEAR";
    readonly label: "1 Year (12 Months)";
}];
export declare function formatSubscriptionDuration(duration?: string | null): string;
export interface Book {
    id: string;
    title: string;
    author: string;
    description: string;
    coverUrl: string;
    heroCoverUrl?: string | null;
    pdfUrl?: string;
    previewPdfUrl?: string | null;
    previewPdfFileName?: string | null;
    previewPdfSizeBytes?: number | null;
    previewAudioUrl?: string | null;
    previewAudioFileName?: string | null;
    previewAudioSizeBytes?: number | null;
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
    subscriptionDuration?: BookSubscriptionDuration | string | null;
    isPremium: boolean;
    isPublished: boolean;
    visibleToGuests: boolean;
    downloadCount: number;
    ordersCount?: number;
    chaptersCount?: number;
    topicsCount?: number;
    isLegacyPlaceholder?: boolean;
    chapters?: Chapter[];
    /** Present on responses from GET /books and GET /books/:id — the caller's purchase state for this book. */
    access?: {
        isPaid: boolean;
        hasAccess: boolean;
        price: number;
        reason: 'FREE' | 'PURCHASED' | 'STAFF' | 'LOGIN_REQUIRED' | 'PAYMENT_REQUIRED';
        subscription?: {
            isSubscription: boolean;
            validTill?: string | null;
            isExpired: boolean;
            expiresInDays?: number | null;
        } | null;
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
/**
 * One subtitle-style segment of an audio track, mapped to the PDF page that
 * should be on screen while it plays. Timestamps are integer **milliseconds**
 * from the start of the audio — page turns in a lecture land between words, so
 * whole seconds are too coarse to place them precisely.
 *
 * Cues are sparse by design: gaps between them hold the previous page rather
 * than falling back to a duration-derived guess, which is what lets a page of
 * dense diagrams stay put while the narrator talks over it.
 */
/**
 * What kind of thing a cue points at. Carried so a viewer can treat a diagram
 * differently from a line of prose — a figure is worth centring and holding,
 * a paragraph is worth scrolling past.
 */
export type PdfSyncRegionKind = 'text' | 'heading' | 'image' | 'table' | 'diagram' | 'other';
/**
 * A rectangle on a PDF page, as a **fraction of the page box** — `x`/`width`
 * across, `y`/`height` down, origin at the top-left, every value in `[0, 1]`.
 *
 * Normalized rather than pixels because the same map has to drive a phone, a
 * desktop browser and every zoom level in between: a pixel rect is only true
 * for the viewport it was measured in, a fraction of the page is true
 * everywhere.
 */
export interface PdfSyncRegion {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface PdfSyncCue {
    /** Inclusive segment start, in ms from the beginning of the audio. */
    startMs: number;
    /** Exclusive segment end, in ms. Always greater than `startMs`. */
    endMs: number;
    /** 1-based PDF page to display for this segment. */
    page: number;
    /**
     * The region of [page] this segment is about. Omitted means the whole page,
     * which is what every cue authored before regions existed means — those maps
     * keep working, they just turn pages instead of scrolling within one.
     */
    target?: PdfSyncRegion;
    /** Defaults to `'text'` when a cue does not say. */
    type?: PdfSyncRegionKind;
}
/** The saved PDF↔audio mapping for one reading unit. */
export interface PdfSyncMap {
    /**
     * Global correction applied to every cue, in ms. Positive values make pages
     * turn later. Lets a reader fix a whole track that drifted uniformly without
     * re-timing each cue.
     */
    offsetMs: number;
    cues: PdfSyncCue[];
    /** Bumped whenever cues are edited, so a stale cached copy can be detected. */
    revision?: number;
    updatedAt?: string;
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
    /** Authored PDF↔audio timing map. Null when this topic was never synced. */
    syncCues?: PdfSyncMap | null;
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
    /** Authored PDF↔audio timing map. Null when this subtopic was never synced. */
    syncCues?: PdfSyncMap | null;
    createdAt: string;
    updatedAt: string;
}
export interface VideoFolder {
    id: string;
    name: string;
    parentId?: string | null;
    description?: string | null;
    orderIndex: number;
    isActive: boolean;
    subFolderCount?: number;
    videoCount?: number;
    children?: VideoFolder[];
    parent?: VideoFolder | null;
    createdAt: string;
    updatedAt: string;
}
/** Shared shape of the legacy library folder levels — maintained for backwards compatibility. */
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
    folderId?: string | null;
    folderName?: string | null;
    chapterId?: string | null;
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
export interface PdfFolder {
    id: string;
    name: string;
    parentId?: string | null;
    description?: string | null;
    orderIndex: number;
    isActive: boolean;
    subFolderCount?: number;
    documentCount?: number;
    children?: PdfFolder[];
    parent?: PdfFolder | null;
    createdAt: string;
    updatedAt: string;
}
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
    folderId?: string | null;
    folderName?: string | null;
    chapterId?: string | null;
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
export interface ReaderSubtopic extends Subtopic {
}
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
    parentId?: string | null;
    parentName?: string | null;
    description?: string | null;
    orderIndex: number;
    isActive: boolean;
    /** Quizzes filed directly under this folder. */
    quizCount?: number;
    subFolderCount?: number;
    /** Free quizzes in this folder *and every folder beneath it*. */
    freeQuizCount?: number;
    /** Paid / premium quizzes in this folder *and every folder beneath it*. */
    paidQuizCount?: number;
    quizzes?: Quiz[];
    createdAt: string;
    updatedAt: string;
}
export interface Quiz {
    id: string;
    title: string;
    category?: string;
    topic?: string | null;
    folderName?: string | null;
    totalQuestions: number;
    durationMinutes: number;
    isLiveMock: boolean;
    isPremium: boolean;
    imageUrl?: string | null;
    showCorrectAnswerAfterSelection?: boolean;
    price: number;
    discountPercent?: number;
    finalPrice?: number;
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
    answers: {
        questionId: string;
        selectedOptionIndex?: number;
    }[];
    timeTakenSeconds: number;
    /** Same duration to millisecond precision. Mock tests rank a tied score on
     * this — two participants can easily finish within the same whole second. */
    timeTakenMs?: number;
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
/** Whether a reviewed question was answered correctly, wrongly, or skipped. */
export type QuizAnswerStatus = 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED';
/** One option, normalized by the server whatever shape the quiz was authored in. */
export interface ReviewOption {
    id: string;
    text: string;
    explanation: string | null;
}
/** One question of a review, paired with what the student picked. */
export interface QuizReviewQuestion {
    id: string;
    /** 1-based position in the quiz's own question order. */
    number: number;
    text: string;
    marks: number;
    explanation?: string | null;
    options: ReviewOption[];
    /** null when the question was skipped. */
    selectedOptionIndex: number | null;
    selectedOptionText: string | null;
    correctOptionIndex: number | null;
    correctOptionText: string | null;
    status: QuizAnswerStatus;
    isCorrect: boolean;
}
/**
 * The scored attempt plus its full answer key, as served by
 * `GET /quizzes/attempts/:attemptId/review`. Both the website and the mobile
 * app render their result/review screens from this exact payload.
 */
export interface QuizAttemptReview {
    id: string;
    quizId: string;
    quizTitle: string;
    /** Gates the "Download Solutions PDF" button — available once an attempt is
     * submitted, and only for a premium quiz. */
    isPremium: boolean;
    attemptNumber: number;
    attemptStatus: 'COMPLETED';
    score: number;
    totalMarks: number;
    percentage: number;
    passed: boolean;
    passingMarks: number;
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    unattempted: number;
    timeTakenSeconds: number;
    startedAt: string;
    submittedAt?: string | null;
    negativeMarking: {
        enabled: boolean;
        every: number;
        deduct: number;
        allowNegativeScore: boolean;
        /** Marks actually deducted on this attempt. */
        deducted: number;
    };
    /**
     * True when the quiz was edited after this attempt, so the stored answers no
     * longer line up with the current questions.
     */
    answersStale: boolean;
    questions: QuizReviewQuestion[];
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
    answers: {
        questionId: string;
        selectedOptionIndex?: number;
    }[];
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
export interface StudentDashboardInProgressQuiz {
    id: string;
    quizId: string;
    title: string;
    totalQuestions: number;
    answeredCount: number;
    progressPercent: number;
    remainingSeconds: number;
    startedAt: string;
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
    trend: {
        label: string;
        date: string;
        percentage: number;
        accuracy: number;
    }[];
    recentAttempts: StudentDashboardAttempt[];
    subjects: {
        category: string;
        attempts: number;
        averagePercent: number;
        accuracyPercent: number | null;
    }[];
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
    inProgressQuizzes: StudentDashboardInProgressQuiz[];
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
    accessType?: string | null;
    validTill?: string | null;
    paidAt?: string | null;
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
    createdAt: string;
    updatedAt: string;
}
/** An order with the purchased item's display details attached — used for "My Orders". */
export interface OrderWithItems extends Order {
    book?: {
        id: string;
        title: string;
        coverUrl: string;
    } | null;
    quiz?: {
        id: string;
        title: string;
        isLiveMock: boolean;
    } | null;
}
export interface SocialLinks {
    id: string;
    telegramUrl: string | null;
    instagramUrl: string | null;
    youtubeUrl: string | null;
    facebookUrl: string | null;
    twitterUrl: string | null;
    /** Store listings for the mobile apps — these drive the home page's download
     * call to action, not the "follow us" cards. */
    playStoreUrl: string | null;
    appStoreUrl: string | null;
    updatedAt: string | null;
}
export type AppUpdateMode = 'immediate' | 'flexible';
/** The wire shape of `GET/PATCH /app/update-config` — read by the mobile app
 * on every launch and by the admin settings form. `platform` is Android-only
 * for now and is passed as a request param, not carried in this body. */
export interface AppUpdateConfig {
    enabled: boolean;
    latestVersion: string;
    minimumVersion: string;
    updateMode: AppUpdateMode;
    forceUpdate: boolean;
    message: string;
    updatedAt: string;
}
export interface CustomerReview {
    id: string;
    customerName: string;
    /** Whole stars, 1–5. */
    rating: number;
    comment: string;
    isActive: boolean;
    orderIndex: number;
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
    status?: 'SENT' | 'SCHEDULED' | string;
    scheduledFor?: string | null;
    /** Where a tap lands: an in-app route like `/books/<id>`, or an https link. */
    route?: string | null;
    /** Optional 16:9 banner image (YouTube thumbnail format). */
    imageUrl?: string | null;
    createdAt: string;
}
/** A row in the composer's "recently sent" list. */
export interface SentNotification extends Notification {
    user?: {
        id: string;
        name: string;
        email: string;
    } | null;
    sentBy?: {
        id: string;
        name: string;
    } | null;
}
/** Whether a push sent right now would actually reach a device. */
export interface PushStatus {
    /** False when the API has no Firebase service-account credentials. */
    configured: boolean;
    /** Registered device tokens, signed-in or not. */
    devices: number;
    /** Distinct students with at least one registered device. */
    students: number;
}
export interface AnnouncementPopup {
    id: string;
    title: string;
    message: string;
    imageUrl?: string | null;
    buttonText?: string | null;
    redirectUrl?: string | null;
    backgroundColor?: string | null;
    isActive: boolean;
    orderIndex: number;
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
