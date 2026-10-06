import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Kerala PSC Video Classes',
  description:
    'Watch exam-wise, chapter-wise Kerala PSC video classes from experienced teachers. Learn concepts, shortcuts and previous-question analysis on any device.',
  path: '/videos',
  keywords: ['Kerala PSC video classes', 'PSC online classes', 'PSC coaching videos'],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
