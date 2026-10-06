import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Create a Free Account',
  description:
    'Sign up free to start preparing for Kerala PSC exams with interactive e-books, daily quizzes, mock tests and audio lessons.',
  path: '/signup',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
