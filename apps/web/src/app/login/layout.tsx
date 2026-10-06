import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Log In',
  description:
    'Log in to PSC Tips And Tricks to continue your Kerala PSC e-books, quizzes, mock tests and progress tracking.',
  path: '/login',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
