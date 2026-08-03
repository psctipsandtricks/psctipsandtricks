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
