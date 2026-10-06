import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Kerala PSC PDF Notes & Question Papers',
  description:
    'Exam-wise Kerala PSC PDF notes, previous year question papers and answer keys organised by chapter for quick revision.',
  path: '/pdfs',
  keywords: ['Kerala PSC PDF', 'PSC previous question papers', 'PSC answer key', 'PSC notes PDF'],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
