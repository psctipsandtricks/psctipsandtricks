import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Kerala PSC E-Books & Study Materials',
  description:
    'Browse interactive Kerala PSC e-books with chapter-wise notes, teacher audio narrations, diagrams and video classes — built for LDC, LGS, Degree Level and other PSC exams.',
  path: '/books',
  keywords: ['Kerala PSC e-books', 'PSC study materials', 'PSC notes Malayalam', 'PSC rank file'],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
