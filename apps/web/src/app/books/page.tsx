'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Library,
  LogIn,
  BookMarked,
  GraduationCap,
} from 'lucide-react';
import { Book } from '@psc/shared-types';
import { useAuth } from '../auth-provider';
import { BookCatalogSkeleton } from '../skeletons/page-skeletons';
import { ApiClient } from '@/lib/api-client';

function BooksContent() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<Book[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab state: 'all' or 'purchased'
  const filterParam = searchParams.get('filter');
  const tabParam = searchParams.get('tab');
  const initialTab = filterParam === 'purchased' || tabParam === 'purchased' ? 'purchased' : 'all';
  const [activeTab, setActiveTab] = useState<'all' | 'purchased'>(initialTab);

  // Sync tab with URL query changes
  useEffect(() => {
    if (filterParam === 'purchased' || tabParam === 'purchased') {
      setActiveTab('purchased');
    } else {
      setActiveTab('all');
    }
  }, [filterParam, tabParam]);

  const handleTabChange = (tab: 'all' | 'purchased') => {
    setActiveTab(tab);
    setCurrentPage(1);
    if (tab === 'purchased') {
      router.push('/books?filter=purchased');
    } else {
      router.push('/books');
    }
  };

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

  // Helper to determine if a book is purchased / owned by the current user
  const isBookPurchased = useCallback((b: Book) => {
    if (!user) return false;
    return (
      b.access?.reason === 'PURCHASED' ||
      b.access?.reason === 'STAFF' ||
      (b.access?.hasAccess && (b.isPremium || (b.finalPrice ?? b.price ?? 0) > 0))
    );
  }, [user]);

  // Purchased books count
  const purchasedBooksCount = books.filter(isBookPurchased).length;

  // Extract and normalize categories based on current tab's available books
  const tabBaseBooks = activeTab === 'purchased' ? books.filter(isBookPurchased) : books;

  const categoryMap = new Map<string, string>();
  tabBaseBooks.forEach((b) => {
    if (b.category?.trim()) {
      const key = b.category.trim().toUpperCase();
      if (!categoryMap.has(key)) {
        categoryMap.set(key, b.category.trim());
      }
    }
  });
  const categories = ['ALL', ...Array.from(categoryMap.keys())];

  const filteredBooks = tabBaseBooks.filter((b) => {
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
  }, [searchTerm, selectedCategory, activeTab]);

  if (!mounted || loading || authLoading) {
    return <BookCatalogSkeleton />;
  }

  return (
    <div className="space-y-6 sm:space-y-8 py-2 sm:py-4 px-1 sm:px-0 w-full max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-500 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{activeTab === 'purchased' ? 'My Digital Library' : 'Kerala PSC 2026 E-Books'}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            {activeTab === 'purchased' ? 'My Purchased Books' : 'PSC Study Materials & E-Books'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed max-w-2xl">
            {activeTab === 'purchased'
              ? 'Access all the digital handbooks, topic notes, audio explanations, and offline study materials you own.'
              : 'Official multimedia handbooks, SCERT textbook subdivisions, solved papers, and audio lessons.'}
          </p>
        </div>

        <div className="w-full md:w-80 shrink-0">
          <Input
            placeholder={activeTab === 'purchased' ? 'Search in your library...' : 'Search books by title or topic...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Top View Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-[#1e2e56] pb-3">
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-[#0c152e] border border-slate-200/80 dark:border-[#1e2e56]">
          <button
            type="button"
            onClick={() => handleTabChange('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white dark:bg-cyan-500 text-slate-900 dark:text-slate-950 shadow-md shadow-slate-900/5 dark:shadow-cyan-500/25'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>All E-Books</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${
                activeTab === 'all'
                  ? 'bg-slate-100 dark:bg-cyan-900/50 text-slate-700 dark:text-cyan-950'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {books.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('purchased')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'purchased'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Library className="w-3.5 h-3.5" />
            <span>My Books</span>
            {user && (
              <span
                className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${
                  activeTab === 'purchased'
                    ? 'bg-white/20 text-white'
                    : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                }`}
              >
                {purchasedBooksCount}
              </span>
            )}
          </button>
        </div>

        {/* Quick status for My Books */}
        {activeTab === 'purchased' && user && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Showing {purchasedBooksCount} purchased {purchasedBooksCount === 1 ? 'book' : 'books'}</span>
          </div>
        )}
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
              {catKey === 'ALL'
                ? activeTab === 'purchased'
                  ? '📚 All Purchased'
                  : '🌟 All E-Books'
                : categoryMap.get(catKey) || catKey}
            </button>
          ))}
        </div>
      )}

      {/* Unauthenticated State for My Books Tab */}
      {activeTab === 'purchased' && !user ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 space-y-4 rounded-3xl border border-dashed border-indigo-500/30 bg-gradient-to-b from-indigo-500/[0.04] to-transparent dark:bg-gradient-to-b dark:from-indigo-950/20 dark:to-[#091124]/50">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-500 shadow-inner">
            <BookMarked className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Sign in to View Your Books
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Log in to your PSC Tips & Tricks account to access your purchased study handbooks, chapter notes, audio podcasts, and offline reading library.
            </p>
          </div>
          <div className="pt-2 flex items-center gap-3">
            <Link href={`/login?redirect=${encodeURIComponent('/books?filter=purchased')}`}>
              <Button size="md" variant="gold" className="font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20">
                <LogIn className="w-4 h-4" />
                <span>Log In to Your Account</span>
              </Button>
            </Link>
            <button
              type="button"
              onClick={() => handleTabChange('all')}
              className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:underline px-3 py-2 cursor-pointer"
            >
              Explore Catalog
            </button>
          </div>
        </div>
      ) : activeTab === 'purchased' && user && paginatedBooks.length === 0 ? (
        /* Empty State for Purchased Books when logged in */
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 space-y-4 rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-slate-50/50 dark:bg-[#091124]/50">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-500 shadow-inner">
            <Library className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {searchTerm ? 'No Matching Purchased Books' : 'Your Book Library is Empty'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {searchTerm
                ? 'No purchased books matched your search query. Try clearing the search.'
                : "You haven't purchased any e-books yet. Explore our curated PSC study handbooks, SCERT subdivisions, and question banks to start building your library!"}
            </p>
          </div>
          <div className="pt-2">
            {searchTerm ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSearchTerm('')}
                className="font-bold text-xs"
              >
                Clear Search
              </Button>
            ) : (
              <Button
                size="md"
                variant="gold"
                onClick={() => handleTabChange('all')}
                className="font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Browse All E-Books</span>
              </Button>
            )}
          </div>
        </div>
      ) : paginatedBooks.length === 0 ? (
        /* General Empty State */
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
            const isOwned = isBookPurchased(book) || (!book.isPremium && book.access?.hasAccess);

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
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-500 text-white shadow-md">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Owned</span>
                        </span>
                      )}
                      {discount > 0 && !isFree && !isOwned && (
                        <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-rose-500 text-white shadow-md">
                          {discount}% OFF
                        </span>
                      )}
                      {isFree && !isOwned && (
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
                      {isOwned ? (
                        <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Purchased
                        </span>
                      ) : isFree ? (
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
                          className="font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Read Now</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="gold"
                          onClick={() => handleBuyNow(book.id)}
                          className="font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
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

export default function BooksPage() {
  return (
    <Suspense fallback={<BookCatalogSkeleton />}>
      <BooksContent />
    </Suspense>
  );
}
