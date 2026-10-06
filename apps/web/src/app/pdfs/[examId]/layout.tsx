import type { Metadata } from 'next';
import type { PdfExam } from '@psc/shared-types';
import { fetchPublic, pageMetadata, toDescription } from '@/lib/seo';

type Props = { params: { examId: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const exam = await fetchPublic<PdfExam>(`/pdfs/exams/${encodeURIComponent(params.examId)}`);
  const path = `/pdfs/${params.examId}`;
  if (!exam) return pageMetadata({ title: 'Kerala PSC PDF Notes', path });
  // Detail endpoints return the folder's `name`; list endpoints alias it as `title`.
  const name = exam.title || ((exam as { name?: string }).name ?? '');
  if (!name) return pageMetadata({ title: 'Kerala PSC PDF Notes', path });
  return pageMetadata({
    title: `${name} — Kerala PSC PDF Notes`,
    description: toDescription(exam.description, `${name}: chapter-wise Kerala PSC PDF notes, previous year question papers and answer keys.`),
    path,
    keywords: [name],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
