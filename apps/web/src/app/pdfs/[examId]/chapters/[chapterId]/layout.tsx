import type { Metadata } from 'next';
import type { PdfChapter } from '@psc/shared-types';
import { fetchPublic, pageMetadata, toDescription } from '@/lib/seo';

type Props = { params: { examId: string; chapterId: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const chapter = await fetchPublic<PdfChapter>(`/pdfs/chapters/${encodeURIComponent(params.chapterId)}`);
  const path = `/pdfs/${params.examId}/chapters/${params.chapterId}`;
  if (!chapter) return pageMetadata({ title: 'Kerala PSC PDF Notes', path });
  // Detail endpoints return the folder's `name`; list endpoints alias it as `title`.
  const name = chapter.title || ((chapter as { name?: string }).name ?? '');
  if (!name) return pageMetadata({ title: 'Kerala PSC PDF Notes', path });
  return pageMetadata({
    title: `${name} — Kerala PSC PDF Notes`,
    description: toDescription(chapter.description, `${name}: Kerala PSC PDF notes and question papers for this chapter.`),
    path,
    keywords: [name],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
