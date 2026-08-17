'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card } from '@psc/ui';
import {
  BookOpen,
  Music,
  FileText,
  Youtube,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Book } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { useAuth } from './auth-provider';

// Fallback curated books in case API has not loaded or for instant SSR
const CURATED_FEATURED_BOOKS: Partial<Book>[] = [
  {
    id: 'scert-basic-social-science',
    title: 'NEW SCERT BASIC SCIENCE & SOCIAL SCIENCE (STD 5–10)',
    author: 'PSC Tips and Tricks Editorial Board',
    description: 'Complete chapter-wise subdivisions from 5th to 10th standard textbook syllabus with audio narration and previous year questions.',
    category: 'SCERT Textbooks',
    price: 399,
    discountPercent: 50,
    finalPrice: 199,
    isPublished: true,
    coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'kerala-history-renaissance',
    title: 'Kerala History & Renaissance Master Guide',
    author: 'Dr. Suresh Kumar & Team',
    description: 'Comprehensive historical timeline from ancient Venad to modern Kerala renaissance leaders, social movements, and key dates.',
    category: 'Kerala History',
    price: 299,
    discountPercent: 40,
    finalPrice: 179,
    isPublished: true,
    coverUrl: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'indian-constitution-governance',
    title: 'Indian Constitution & Public Administration',
    author: 'PSC Tips and Tricks Law Faculty',
    description: 'Articles, amendments, constitutional bodies, and landmark judgments tailored for Kerala PSC preliminary and main exams.',
    category: 'Indian Constitution',
    price: 349,
    discountPercent: 45,
    finalPrice: 189,
    isPublished: true,
    coverUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'maths-mental-ability-shortcuts',
    title: 'Maths & Mental Ability 500+ Shortcut Tricks',
    author: 'Prof. Rajesh M. Pillai',
    description: 'Speed maths, data interpretation, number series, and logical reasoning shortcuts to score full marks in 20 minutes.',
    category: 'Mathematics',
    price: 249,
    discountPercent: 40,
    finalPrice: 149,
    isPublished: true,
    coverUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&auto=format&fit=crop&q=80',
  },
];

export function HomeBooksShowcase() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const res = await ApiClient.getBooks();
        const list: Book[] = Array.isArray(res) ? res : res?.data || [];
        const published = list.filter((b: Book) => b.isPublished);
        if (published.length > 0) {
          setBooks(published);
        } else {
          setBooks(CURATED_FEATURED_BOOKS as Book[]);
        }
      } catch {
        setBooks(CURATED_FEATURED_BOOKS as Book[]);
      } finally {
        setLoading(false);
      }
    };
    fetchBooks();
  }, []);

  const displayBooks = books.length > 0 ? books : (CURATED_FEATURED_BOOKS as Book[]);

  // De-duplicate categories case-insensitively
  const categoryMap = new Map<string, string>();
  displayBooks.forEach((b) => {
    if (b.category?.trim()) {
      const key = b.category.trim().toUpperCase();
      if (!categoryMap.has(key)) {
        categoryMap.set(key, b.category.trim());
      }
    }
  });

  const categories = ['ALL', ...Array.from(categoryMap.keys())];

  const filteredBooks =
    selectedCategory === 'ALL'
      ? displayBooks
      : displayBooks.filter((b) => b.category?.trim().toUpperCase() === selectedCategory);

  const handleOpenBook = (bookId: string) => {
    router.push(`/books/${bookId}/read`);
  };

  const handleBuyBook = (bookId: string) => {
    const targetUrl = `/checkout?type=book&id=${bookId}`;
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    } else {
      router.push(targetUrl);
    }
  };

  return (
    <div className="space-y-8 w-full">
      {/* Category Filter Tabs */}
      {categories.length > 2 && (
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((catKey) => (
            <button
              key={catKey}
              type="button"
              onClick={() => setSelectedCategory(catKey)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === catKey
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 scale-105'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {catKey === 'ALL' ? '🌟 All PSC E-Books' : categoryMap.get(catKey) || catKey}
            </button>
          ))}
        </div>
      )}

      {/* Dynamic Full-Width Book Grid */}
      <div
        className={`grid gap-6 w-full ${
          filteredBooks.length === 1
            ? 'grid-cols-1 max-w-xl mx-auto'
            : filteredBooks.length === 2
              ? 'grid-cols-1 md:grid-cols-2 w-full'
              : filteredBooks.length === 3
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full'
                : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 w-full'
        }`}
      >
        {filteredBooks.slice(0, 8).map((book) => {
          const originalPrice = book.price || 0;
          const discount = book.discountPercent || 0;
          const effectivePrice = book.finalPrice ?? (discount > 0 ? Math.round(originalPrice * (1 - discount / 100)) : originalPrice);
          const isFree = !book.isPremium || effectivePrice === 0;

          return (
            <div
              key={book.id}
              className="group rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] shadow-lg hover:shadow-2xl hover:shadow-cyan-950/20 dark:hover:border-cyan-500/40 transition-all duration-300 flex flex-col overflow-hidden hover:-translate-y-1.5 w-full"
            >
              {/* Cover Image & Badges Container — Reduced height by 30% */}
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
                  {discount > 0 && !isFree && (
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
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">By {book.author || 'PSC Editorial Board'}</p>
                  <h3 className="font-black text-slate-900 dark:text-white text-base leading-snug line-clamp-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                    {book.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {book.description}
                  </p>
                </div>

                {/* Pricing & CTA */}
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
                    <Button
                      size="sm"
                      variant="gold"
                      onClick={() => handleOpenBook(book.id)}
                      className="font-bold text-xs shadow-md shadow-amber-500/10 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 mr-1" />
                      <span>Read</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View All E-Books Link */}
      <div className="flex justify-center pt-2">
        <Link href="/books">
          <Button size="lg" variant="outline" className="font-extrabold px-8 rounded-2xl border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 transition-all shadow-md">
            <span>Explore Full E-Book Catalog</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
