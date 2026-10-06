import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Kerala PSC Online Quizzes & Mock Tests',
  description:
    'Practice topic-wise Kerala PSC quizzes and timed mock tests with instant answer explanations, negative marking and live rank tracking. New quizzes added regularly.',
  path: '/quizzes',
  keywords: ['Kerala PSC online quiz', 'Kerala PSC mock test', 'PSC model exam', 'PSC daily quiz'],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
