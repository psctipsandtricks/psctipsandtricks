import type { MetadataRoute } from 'next';
import type { Book, VideoExam, PdfExam } from '@psc/shared-types';
import { SITE_URL, fetchPublic, asList } from '@/lib/seo';

// Rebuilt at most hourly so newly published books show up without a redeploy.
export const revalidate = 3600;

const STATIC_ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/books', changeFrequency: 'daily', priority: 0.9 },
  { path: '/quizzes', changeFrequency: 'daily', priority: 0.9 },
  { path: '/videos', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/pdfs', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/community', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/signup', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/login', changeFrequency: 'yearly', priority: 0.3 },
];

function lastModified(entity: { updatedAt?: string; createdAt?: string }): Date | undefined {
  const raw = entity.updatedAt || entity.createdAt;
  const d = raw ? new Date(raw) : undefined;
  return d && !Number.isNaN(d.getTime()) ? d : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [booksRes, videoExamsRes, pdfExamsRes] = await Promise.all([
    fetchPublic<unknown>('/books'),
    fetchPublic<unknown>('/videos/exams'),
    fetchPublic<unknown>('/pdfs/exams'),
  ]);

  const books = asList<Book & { updatedAt?: string; createdAt?: string }>(booksRes).filter((b) => b.isPublished);
  const videoExams = asList<VideoExam>(videoExamsRes).filter((e) => e.isActive !== false);
  const pdfExams = asList<PdfExam>(pdfExamsRes).filter((e) => e.isActive !== false);

  return [
    ...STATIC_ROUTES.map((r) => ({
      url: `${SITE_URL}${r.path === '/' ? '' : r.path}`,
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })),
    ...books.map((b) => ({
      url: `${SITE_URL}/books/${b.id}`,
      lastModified: lastModified(b) ?? now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...videoExams.map((e) => ({
      url: `${SITE_URL}/videos/${e.id}`,
      lastModified: lastModified(e) ?? now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...pdfExams.map((e) => ({
      url: `${SITE_URL}/pdfs/${e.id}`,
      lastModified: lastModified(e) ?? now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
