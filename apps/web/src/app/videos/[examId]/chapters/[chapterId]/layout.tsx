import type { Metadata } from 'next';
import type { VideoChapter } from '@psc/shared-types';
import { fetchPublic, pageMetadata, toDescription } from '@/lib/seo';

type Props = { params: { examId: string; chapterId: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const chapter = await fetchPublic<VideoChapter>(`/videos/chapters/${encodeURIComponent(params.chapterId)}`);
  const path = `/videos/${params.examId}/chapters/${params.chapterId}`;
  if (!chapter) return pageMetadata({ title: 'Kerala PSC Video Classes', path });
  // Detail endpoints return the folder's `name`; list endpoints alias it as `title`.
  const name = chapter.title || ((chapter as { name?: string }).name ?? '');
  if (!name) return pageMetadata({ title: 'Kerala PSC Video Classes', path });
  return pageMetadata({
    title: `${name} — Kerala PSC Video Classes`,
    description: toDescription(chapter.description, `${name}: Kerala PSC video lessons for this chapter with downloadable notes.`),
    path,
    keywords: [name],
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
