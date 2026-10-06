import type { Metadata } from 'next';
import type { Quiz } from '@psc/shared-types';
import { fetchPublic, pageMetadata } from '@/lib/seo';

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const quiz = await fetchPublic<Quiz>(`/quizzes/${encodeURIComponent(params.id)}`);
  const path = `/quizzes/${params.id}`;
  if (!quiz) return pageMetadata({ title: 'Kerala PSC Quiz', path });
  const topic = quiz.topic || quiz.category || quiz.folderName;
  return pageMetadata({
    title: `${quiz.title} — Kerala PSC ${quiz.isLiveMock ? 'Mock Test' : 'Quiz'}`,
    description: `Attempt "${quiz.title}"${topic ? ` (${topic})` : ''}: ${quiz.totalQuestions} questions in ${quiz.durationMinutes} minutes with instant answers, explanations and rank tracking.`,
    path,
    keywords: [quiz.title, topic].filter(Boolean) as string[],
    images: quiz.imageUrl ? [{ url: quiz.imageUrl, alt: quiz.title }] : undefined,
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
