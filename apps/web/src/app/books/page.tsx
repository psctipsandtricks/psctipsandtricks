'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter, Button, Badge, Input, Pagination } from '@psc/ui';
import { Search, Download, ArrowRight, ShoppingCart } from 'lucide-react';
import { useAuth } from '../auth-provider';
import { BookCatalogSkeleton } from '../skeletons/page-skeletons';

const SAMPLE_BOOKS = [
  {
    id: 'book-1',
    title: 'Kerala PSC Master Question Bank 2026',
    author: 'PSC Tips Expert Team',
    description: '10,000+ Previous Year Questions with detailed explanations and shortcuts.',
    price: 299,
    category: 'Question Bank',
    coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
    downloadCount: 1420,
  },
  {
    id: 'book-2',
    title: 'Indian Constitution & Polity Guide',
    author: 'Dr. K. R. Nambiar',
    description: 'Articles, Amendments, Landmark judgements and memory tricks.',
    price: 199,
    category: 'Polity',
    coverUrl: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=600&q=80',
    downloadCount: 850,
  },
  {
    id: 'book-3',
    title: 'Kerala History & Cultural Heritage',
    author: 'Prof. S. R. Pillai',
    description: 'Comprehensive guide covering Travancore, Cochin, and Malabar history for Tenth/Degree Level.',
    price: 249,
    category: 'Kerala GK',
    coverUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80',
    downloadCount: 620,
  },
];

export default function BooksPage() {
  const [mounted, setMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleBuyNow = (bookId: string) => {
    const targetUrl = `/checkout?type=book&id=${bookId}`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredBooks = SAMPLE_BOOKS.filter((b) =>
    b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalItems = filteredBooks.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedBooks = filteredBooks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (!mounted) {
    return <BookCatalogSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-8 py-2 sm:py-4 px-1 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">PSC Study Materials & E-Books</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">Download official PSC handbooks, solved papers, and topic-wise guides.</p>
        </div>
        <div className="w-full md:w-80">
          <Input
            placeholder="Search books by title or topic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {paginatedBooks.map((book) => (
          <Card key={book.id} hoverEffect className="flex flex-col justify-between p-4 sm:p-6">
            <CardHeader className="space-y-3 p-0">
              <div className="flex justify-between items-start">
                <Badge variant="gold">{book.category}</Badge>
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center space-x-1 font-mono">
                  <Download className="w-3.5 h-3.5" />
                  <span>{book.downloadCount}</span>
                </span>
              </div>
              <CardTitle className="text-lg leading-snug">{book.title}</CardTitle>
              <p className="text-xs text-amber-500 dark:text-amber-400 font-semibold">By {book.author}</p>
              <CardDescription>{book.description}</CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-between items-center pt-6 p-0 border-t border-slate-200/80 dark:border-slate-800/80 mt-4">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Price</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">₹{book.price}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Link href={`/books/${book.id}`}>
                  <Button variant="outline" size="sm" className="font-bold">
                    <span>Details</span>
                  </Button>
                </Link>
                <Button
                  variant="gold"
                  size="sm"
                  onClick={() => handleBuyNow(book.id)}
                  className="font-bold flex items-center space-x-1"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Buy Now</span>
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        pageSizeOptions={[6, 9, 12, 24]}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
      />
    </div>
  );
}
