import type { Metadata } from 'next';
import type { VideoExam } from '@psc/shared-types';
import { fetchPublic, pageMetadata, toDescription } from '@/lib/seo';

type Props = { params: { examId: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const exam = await fetchPublic<VideoExam>(`/videos/exams/${encodeURIComponent(params.examId)}`);
  const path = `/videos/${params.examId}`;
  if (!exam) return pageMetadata({ title: 'Kerala PSC Video Classes', path });
  // Detail endpoints return the folder's `name`; list endpoints alias it as `title`.
  const name = exam.title || ((exam as { name?: string }).name ?? '');
  if (!name) return pageMetadata({ title: 'Kerala PSC Video Classes', path });
  return pageMetadata({
    title: `${name} — Kerala PSC Video Classes`,
    description: toDescription(exam.description, `${name}: chapter-wise Kerala PSC video classes with notes and previous-question analysis.`),
    path,
    keywords: [name],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
