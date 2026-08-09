import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create Test Admin User
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@psctips.com' },
    update: {},
    create: {
      email: 'admin@psctips.com',
      password: adminPassword,
      name: 'PSC Admin Master',
      role: UserRole.ADMIN,
      isPremium: true,
    },
  });
  console.log('✅ Created Admin user:', admin.email);

  // Create Test Student User
  const studentPassword = await bcrypt.hash('Student@123', 10);
  const student = await prisma.user.upsert({
    where: { email: 'student@psctips.com' },
    update: {},
    create: {
      email: 'student@psctips.com',
      password: studentPassword,
      name: 'Kerala PSC Aspirant',
      role: UserRole.STUDENT,
      isPremium: false,
    },
  });
  console.log('✅ Created Student user:', student.email);

  // Create Test Staff User with a sample permission matrix
  const staffPassword = await bcrypt.hash('Staff@123', 10);
  const staff = await prisma.user.upsert({
    where: { email: 'staff@psctips.com' },
    update: {},
    create: {
      email: 'staff@psctips.com',
      password: staffPassword,
      name: 'PSC Content Staff',
      role: UserRole.STAFF,
      staffPermission: {
        create: {
          manageBooks: true,
          manageQuizzes: true,
          manageChat: true,
          manageCoupons: false,
          manageNotifications: false,
          viewOrders: false,
          viewAnalytics: false,
          manageUsers: false,
          grantedById: admin.id,
        },
      },
    },
  });
  console.log('✅ Created Staff user:', staff.email);

  // Create Sample Books
  const book1 = await prisma.book.create({
    data: {
      title: 'Kerala PSC Master Question Bank 2026',
      author: 'PSC Tips Expert Team',
      description: 'Comprehensive collection of 10,000+ previous year questions with detailed explanations.',
      coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
      pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      price: 299,
      category: 'Question Bank',
      isPublished: true,
      downloadCount: 1420,
    },
  });

  const book2 = await prisma.book.create({
    data: {
      title: 'Indian Constitution & Polity Guide for PSC',
      author: 'Dr. K. R. Nambiar',
      description: 'In-depth coverage of Articles, Amendments, Landmark judgements and short tricks for memorization.',
      coverUrl: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=600&q=80',
      pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      price: 199,
      category: 'Polity',
      isPublished: true,
      downloadCount: 850,
    },
  });
  console.log('✅ Created 2 Sample Books');

  // Create Sample Chapters for Book 1
  await prisma.chapter.createMany({
    data: [
      {
        bookId: book1.id,
        title: 'Chapter 1: General Knowledge Fundamentals',
        orderIndex: 1,
        textContent: 'An overview of the core General Knowledge topics tested in Kerala PSC exams.',
        status: 'PUBLISHED',
      },
      {
        bookId: book1.id,
        title: 'Chapter 2: Kerala Renaissance & History',
        orderIndex: 2,
        textContent: 'Deep dive into the Kerala Renaissance movement and key historical events.',
        status: 'PUBLISHED',
      },
      {
        bookId: book1.id,
        title: 'Chapter 3: Current Affairs 2026',
        orderIndex: 3,
        textContent: 'Latest current affairs relevant to upcoming PSC examinations.',
        status: 'DRAFT',
      },
    ],
  });
  console.log('✅ Created 3 Sample Chapters for Book 1');

  // Create Sample Live Mock Quiz
  const quiz1 = await prisma.quiz.create({
    data: {
      title: 'Kerala PSC LDC Mega Mock Test 2026',
      category: 'LDC / Tenth Level',
      description: 'Full-length 100-mark mock test based on current syllabus pattern with negative marking.',
      totalQuestions: 5,
      durationMinutes: 15,
      isLiveMock: true,
      passingMarks: 40,
      totalMarks: 5,
      questions: {
        create: [
          {
            text: 'Which is the longest river in Kerala?',
            options: [
              { id: '1', text: 'Periyar' },
              { id: '2', text: 'Bharathappuzha' },
              { id: '3', text: 'Pamba' },
              { id: '4', text: 'Chaliyar' },
            ],
            correctOptionIndex: 0,
            explanation: 'Periyar is the longest river in Kerala with a length of 244 km.',
            marks: 1,
          },
          {
            text: 'Who is known as the Father of Kerala Renaissance?',
            options: [
              { id: '1', text: 'Sree Narayana Guru' },
              { id: '2', text: 'Chattampi Swamikal' },
              { id: '3', text: 'Ayyankali' },
              { id: '4', text: 'Vakkom Moulavi' },
            ],
            correctOptionIndex: 0,
            explanation: 'Sree Narayana Guru led the social reform movement against caste discrimination in Kerala.',
            marks: 1,
          },
          {
            text: 'What is the capital of Lakshadweep?',
            options: [
              { id: '1', text: 'Kavaratti' },
              { id: '2', text: 'Minicoy' },
              { id: '3', text: 'Agatti' },
              { id: '4', text: 'Andrott' },
            ],
            correctOptionIndex: 0,
            explanation: 'Kavaratti is the capital of the Union Territory of Lakshadweep.',
            marks: 1,
          },
          {
            text: 'Which Article of Indian Constitution guarantees Right to Equality?',
            options: [
              { id: '1', text: 'Article 14 to 18' },
              { id: '2', text: 'Article 19' },
              { id: '3', text: 'Article 21' },
              { id: '4', text: 'Article 32' },
            ],
            correctOptionIndex: 0,
            explanation: 'Articles 14 to 18 of the Constitution deal with Right to Equality.',
            marks: 1,
          },
          {
            text: 'Who was the first Chief Minister of Kerala?',
            options: [
              { id: '1', text: 'E. M. S. Namboodiripad' },
              { id: '2', text: 'Pattam A. Thanu Pillai' },
              { id: '3', text: 'R. Sankar' },
              { id: '4', text: 'C. Achutha Menon' },
            ],
            correctOptionIndex: 0,
            explanation: 'EMS Namboodiripad became the first CM of Kerala in 1957.',
            marks: 1,
          },
        ],
      },
    },
  });
  console.log('✅ Created Live Mock Quiz with Questions');

  // Create Sample Scheduled Mock Test (scheduled 10 minutes from now)
  const mockTest = await prisma.mockTest.create({
    data: {
      title: 'Weekly All-Kerala LDC Mock Test',
      quizId: quiz1.id,
      scheduledAt: new Date(Date.now() + 10 * 60 * 1000),
      createdById: admin.id,
    },
  });
  console.log('✅ Created Scheduled Mock Test:', mockTest.title);

  // Create Sample Chat Groups (community study circles)
  const chatGroupsData = [
    {
      name: 'Kerala PSC LDC 2026 Warriors',
      description: 'Official study circle for LDC 2026 examination. Daily questions, model tests, and tips.',
      category: 'Kerala PSC',
      iconEmoji: '🏆',
      coverGradient: 'from-amber-500/20 to-orange-600/20',
    },
    {
      name: 'General Knowledge & Current Affairs',
      description: 'Daily Kerala & National news summary, facts, PSC repeatedly asked GK questions, and weekly quizzes.',
      category: 'Subject Wise',
      iconEmoji: '📚',
      coverGradient: 'from-emerald-500/20 to-teal-600/20',
    },
    {
      name: 'SSC CGL & CHSL Aspirants',
      description: 'Target SSC CGL & CHSL Tier I & II exams. Quantitative aptitude, English, and Reasoning daily drills.',
      category: 'SSC & UPSC',
      iconEmoji: '⚡',
      coverGradient: 'from-indigo-500/20 to-purple-600/20',
    },
    {
      name: 'Maths & Mental Ability Shortcuts',
      description: 'Shortcut tricks for PSC math, speed calculation techniques, and step-by-step problem solving.',
      category: 'Subject Wise',
      iconEmoji: '🔢',
      coverGradient: 'from-rose-500/20 to-pink-600/20',
    },
    {
      name: 'English & Malayalam Grammar Circle',
      description: 'Master idioms, vocabulary, tenses, translation, and grammatical corrections for Kerala PSC tests.',
      category: 'Subject Wise',
      iconEmoji: '✍️',
      coverGradient: 'from-cyan-500/20 to-blue-600/20',
    },
  ];

  const chatGroups = [];
  for (const data of chatGroupsData) {
    chatGroups.push(await prisma.chatGroup.create({ data: { ...data, type: 'community' } }));
  }

  // Admin joins and posts a welcome announcement in the first group
  const ldcGroup = chatGroups[0];
  await prisma.chatGroupMember.create({
    data: { groupId: ldcGroup.id, userId: admin.id, role: 'ADMIN' },
  });
  await prisma.chatMessage.create({
    data: {
      userId: admin.id,
      userName: admin.name,
      content: '📌 OFFICIAL ANNOUNCEMENT: Live Mock Test #4 for LDC 2026 will start this Saturday at 10:00 AM IST! Make sure to review Indian Constitution and Kerala Geography modules.',
      groupId: ldcGroup.id,
      messageType: 'TEXT',
      metadata: { isPinned: true, isAnnouncement: true },
    },
  });

  // Student joins two groups so there's realistic membership/read-state to test against
  await prisma.chatGroupMember.create({ data: { groupId: ldcGroup.id, userId: student.id } });
  await prisma.chatGroupMember.create({ data: { groupId: chatGroups[1].id, userId: student.id } });
  console.log(`✅ Created ${chatGroups.length} Sample Chat Groups`);

  // Create Sample Announcement Popup
  await prisma.announcementPopup.create({
    data: {
      title: 'Welcome to PSC Tips & Tricks 2026!',
      message: 'New mock tests and study material added weekly. Good luck with your preparation!',
      isActive: true,
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });
  console.log('✅ Created Sample Announcement Popup');

  // Create Sample Coupon
  await prisma.coupon.create({
    data: {
      code: 'PSC2026',
      discountPercent: 20,
      maxDiscountAmount: 100,
      validTill: new Date('2027-12-31'),
      isActive: true,
    },
  });
  console.log('✅ Created Sample Coupon: PSC2026');

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
