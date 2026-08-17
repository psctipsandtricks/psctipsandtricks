'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Input, Pagination } from '@psc/ui';
import {
  Search,
  Eye,
  ArrowRight,
  ShoppingCart,
  BookOpen,
  CheckCircle2,
  Music,
  FileText,
  Youtube,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Book } from '@psc/shared-types';
import { useAuth } from '../auth-provider';
import { BookCatalogSkeleton } from '../skeletons/page-skeletons';
import { ApiClient } from '@/lib/api-client';

export default function BooksPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const { user } = useAuth();
  const router = useRouter();

  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await ApiClient.getBooks();
      const list: Book[] = Array.isArray(res) ? res : res?.data || [];
      setBooks(list.filter((b: Book) => b.isPublished));
    } catch (err) {
      console.error('Failed to fetch books:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchBooks();
  }, [fetchBooks]);

  const handleBuyNow = (bookId: string) => {
    const targetUrl = `/checkout?type=book&id=${bookId}`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  const handleView = (book: Book) => {
    const targetUrl = `/books/${book.id}/read`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  // Extract and normalize categories
  const categoryMap = new Map<string, string>();
  books.forEach((b) => {
    if (b.category?.trim()) {
      const key = b.category.trim().toUpperCase();
      if (!categoryMap.has(key)) {
        categoryMap.set(key, b.category.trim());
      }
    }
  });
  const categories = ['ALL', ...Array.from(categoryMap.keys())];

  const filteredBooks = books.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.author.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === 'ALL' ||
      b.category?.trim().toUpperCase() === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const totalItems = filteredBooks.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedBooks = filteredBooks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  if (!mounted || loading) {
    return <BookCatalogSkeleton />;
  }

  return (
    <div className="space-y-6 sm:space-y-8 py-2 sm:py-4 px-1 sm:px-0 w-full max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-500 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Kerala PSC 2026 E-Books</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            PSC Study Materials & E-Books
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
            Official multimedia handbooks, SCERT textbook subdivisions, solved papers, and audio lessons.
          </p>
        </div>

        <div className="w-full md:w-80 shrink-0">
          <Input
            placeholder="Search books by title or topic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Category Pills */}
      {categories.length > 2 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((catKey) => (
            <button
              key={catKey}
              type="button"
              onClick={() => setSelectedCategory(catKey)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === catKey
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 scale-105'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {catKey === 'ALL' ? '🌟 All E-Books' : categoryMap.get(catKey) || catKey}
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {paginatedBooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 space-y-3 rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#091124]/50">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Books Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
              {searchTerm ? 'No books match your search term.' : 'No e-books have been published yet. Check back soon.'}
            </p>
          </div>
        </div>
      ) : (
        /* Full-Width Book Grid */
        <div
          className={`grid gap-6 w-full ${
            paginatedBooks.length === 1
              ? 'grid-cols-1 max-w-xl mx-auto'
              : paginatedBooks.length === 2
                ? 'grid-cols-1 md:grid-cols-2 w-full'
                : paginatedBooks.length === 3
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full'
                  : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 w-full'
          }`}
        >
          {paginatedBooks.map((book) => {
            const originalPrice = book.price || 0;
            const discount = book.discountPercent || 0;
            const effectivePrice =
              book.finalPrice ??
              (discount > 0 ? Math.round(originalPrice * (1 - discount / 100)) : originalPrice);
            const isFree = !book.isPremium || effectivePrice === 0;
            const isOwned = book.access?.hasAccess;

            return (
              <div
                key={book.id}
                className="group rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] shadow-lg hover:shadow-2xl hover:shadow-cyan-950/20 dark:hover:border-cyan-500/40 transition-all duration-300 flex flex-col overflow-hidden hover:-translate-y-1.5 w-full"
              >
                {/* Cover Image & Badges Container */}
                <div className="relative h-60 sm:h-72 md:h-[300px] w-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
                  {book.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-cyan-400 p-6 bg-gradient-to-b from-cyan-950/30 to-slate-950/60">
                      <BookOpen className="w-16 h-16 stroke-[1.5] mb-2 text-cyan-400/70" />
                      <span className="text-xs font-bold text-center text-slate-300 line-clamp-2">{book.title}</span>
                    </div>
                  )}

                  {/* Top Badge Overlay */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-1.5">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-950/80 backdrop-blur-md text-amber-400 border border-amber-500/30 shadow-md">
                      {book.category || 'PSC Special'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isOwned && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500 text-white shadow-md">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Owned</span>
                        </span>
                      )}
                      {discount > 0 && !isFree && !isOwned && (
                        <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-rose-500 text-white shadow-md">
                          {discount}% OFF
                        </span>
                      )}
                      {isFree && (
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-500 text-white shadow-md">
                          FREE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Multimedia Feature Pill Overlay */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 text-[10px] text-white">
                    <span className="flex items-center gap-1 font-bold text-cyan-400">
                      <Music className="w-3 h-3" /> Audio
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="flex items-center gap-1 font-bold text-amber-400">
                      <FileText className="w-3 h-3" /> Notes
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="flex items-center gap-1 font-bold text-rose-400">
                      <Youtube className="w-3 h-3" /> Video
                    </span>
                  </div>
                </div>

                {/* Content Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">By {book.author || 'PSC Editorial Board'}</p>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                        <Eye className="w-3 h-3" /> {book.downloadCount}
                      </span>
                    </div>

                    <h3 className="font-black text-slate-900 dark:text-white text-base leading-snug line-clamp-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                      {book.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {book.description}
                    </p>
                  </div>

                  {/* Pricing & CTA Buttons */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <div>
                      {isFree ? (
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400">Free Access</span>
                      ) : (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                            ₹{effectivePrice}
                          </span>
                          {originalPrice > effectivePrice && (
                            <span className="text-xs text-slate-400 line-through font-mono">
                              ₹{originalPrice}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Link href={`/books/${book.id}`}>
                        <Button variant="outline" size="sm" className="font-bold text-xs">
                          Details
                        </Button>
                      </Link>

                      {isOwned || isFree ? (
                        <Button
                          size="sm"
                          variant="gold"
                          onClick={() => handleView(book)}
                          className="font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5 mr-1" />
                          <span>Read</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="gold"
                          onClick={() => handleBuyNow(book.id)}
                          className="font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer"
                        >
                          <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                          <span>Buy Now</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          pageSizeOptions={[6, 8, 12, 24]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      )}
    </div>
  );
}
