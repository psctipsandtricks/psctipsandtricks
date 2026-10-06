import type { Metadata } from 'next';
import type { Book } from '@psc/shared-types';
import { JsonLd } from '@/components/json-ld';
import { SITE_URL, absoluteUrl, breadcrumbJsonLd, fetchPublic, pageMetadata, toDescription } from '@/lib/seo';

type Props = { params: { id: string }; children: React.ReactNode };

function getBook(id: string) {
  return fetchPublic<Book>(`/books/${encodeURIComponent(id)}`);
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const book = await getBook(params.id);
  const path = `/books/${params.id}`;
  if (!book) {
    return pageMetadata({ title: 'Kerala PSC E-Book', path });
  }
  const cover = book.heroCoverUrl || book.coverUrl;
  return pageMetadata({
    title: `${book.title} — Kerala PSC E-Book`,
    description: toDescription(
      book.description,
      `${book.title} by ${book.author}: interactive Kerala PSC e-book with chapter-wise notes, audio lessons and quizzes.`,
    ),
    path,
    type: 'book',
    keywords: [book.title, book.category, book.author].filter(Boolean),
    images: cover ? [{ url: cover, alt: `${book.title} cover` }] : undefined,
  });
}

export default async function BookLayout({ params, children }: Props) {
  // Same fetch as generateMetadata — Next dedupes it within the request.
  const book = await getBook(params.id);
  const url = absoluteUrl(`/books/${params.id}`);

  return (
    <>
      {book && (
        <JsonLd
          data={[
            {
              '@context': 'https://schema.org',
              '@type': ['Book', 'Product'],
              '@id': `${url}#book`,
              name: book.title,
              url,
              author: { '@type': 'Person', name: book.author },
              publisher: { '@id': `${SITE_URL}/#organization` },
              description: toDescription(book.description, book.title, 500),
              image: book.coverUrl || undefined,
              genre: book.category || undefined,
              bookFormat: 'https://schema.org/EBook',
              inLanguage: ['en', 'ml'],
              ...(book.publicationYear ? { datePublished: String(book.publicationYear) } : {}),
              brand: { '@type': 'Brand', name: 'PSC Tips And Tricks' },
              offers: {
                '@type': 'Offer',
                url,
                priceCurrency: 'INR',
                price: Number(book.finalPrice ?? book.price ?? 0).toFixed(2),
                availability: 'https://schema.org/InStock',
                seller: { '@id': `${SITE_URL}/#organization` },
              },
            },
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'E-Books', path: '/books' },
              { name: book.title, path: `/books/${params.id}` },
            ]),
          ]}
        />
      )}
      {children}
    </>
  );
}
