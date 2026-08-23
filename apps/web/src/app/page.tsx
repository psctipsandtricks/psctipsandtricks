import React from 'react';
import Link from 'next/link';
import { Button, Card, Badge } from '@psc/ui';
import { MessageCircle, HelpCircle, ArrowRight } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { Book } from '@psc/shared-types';
import { HomeBooksShowcase } from './home-books-showcase';
import { HomeBookCarousel } from './home-book-carousel';
import { HomeQuizCarousel } from './home-quiz-carousel';
import { HomeReviewsCarousel } from './home-reviews-carousel';
import { HomeSocialLinks } from './home-social-links';
import { Reveal } from './reveal';

const CONTACT_PHONE_DISPLAY = '+91 88919 30605';
const CONTACT_PHONE_WHATSAPP = 'https://wa.me/918891930605';

async function getInitialBooks(): Promise<Book[]> {
  try {
    const res = await ApiClient.getBooks();
    const list: Book[] = Array.isArray(res) ? res : (res as any)?.data || [];
    return list.filter((b: Book) => b.isPublished);
  } catch {
    return [];
  }
}

const FAQS = [
  {
    question: 'How do PSC Tips And Tricks E-Books work?',
    answer:
      'Our E-Books are interactive multimedia study modules. Instead of boring static PDFs, each book is broken into structured chapters with audio narrations, detailed notes, and video classes you can study anywhere.',
  },
  {
    question: 'Can I listen to audio explanations while reading?',
    answer:
      'Yes! Every topic includes a teacher audio lesson you can play alongside your notes, right in the reader.',
  },
  {
    question: 'Can I prepare for Kerala PSC exams on mobile?',
    answer:
      'Yes. Our mobile app and responsive web reader offer offline-ready reading, dark mode, high-yield summaries, and audio lectures.',
  },
  {
    question: 'How do I take chapter-wise mock tests and quizzes?',
    answer:
      'Each subject module includes timed quizzes, rank calculations, and instant answer explanations to assess your retention.',
  },
] as const;

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative mb-6 sm:mb-10">
      <div className="max-w-2xl mx-auto text-center space-y-2 sm:space-y-3 px-1 sm:px-0">
        <Badge variant="gold" className="text-[10px] sm:text-[11px] uppercase tracking-widest px-2.5 sm:px-3 py-0.5 sm:py-1">
          {eyebrow}
        </Badge>
        <h2 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
          {title}
        </h2>
        {description && (
          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm md:text-base leading-relaxed max-w-xl mx-auto">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="mt-3.5 sm:mt-0 flex justify-center sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2">
          {action}
        </div>
      )}
    </div>
  );
}

export default async function HomePage() {
  const initialBooks = await getInitialBooks();

  return (
    <div className="space-y-20 sm:space-y-28 py-4">
      {/* ── 1. Book Cover Carousel (Live Book Showcase) ──────────────── */}
      <HomeBookCarousel initialBooks={initialBooks} />

      {/* ── 2. Featured E-Books Showcase Catalog ───────────────────── */}
      <Reveal as="section" id="books-catalog">
        <SectionHeading
          eyebrow="PSC E-Book Catalog"
          title="Curated Study Materials & Standard E-Books"
          description="Explore our complete library of PSC exam preparation books with audio narrations, diagrams, and topic notes."
          action={
            <Link
              href="/books"
              className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-slate-100 dark:bg-slate-800/80 hover:bg-cyan-500/10 dark:hover:bg-cyan-500/20 text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 border border-slate-200/80 dark:border-slate-700/80 hover:border-cyan-500/40 transition-all shadow-sm cursor-pointer"
            >
              <span>All Books</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 text-cyan-500" />
            </Link>
          }
        />
        <HomeBooksShowcase initialBooks={initialBooks} />
      </Reveal>

      {/* ── 3. Latest Quizzes Rail (Secondary Accent) ──────────────── */}
      <Reveal as="section" id="quizzes-catalog">
        <SectionHeading
          eyebrow="Quick Revision & Quizzes"
          title="Test Your Knowledge After Reading"
          description="Reinforce every E-Book chapter with topic-wise practice questions and live mock tests — the newest quizzes come first."
          action={
            <Link
              href="/quizzes"
              className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-slate-100 dark:bg-slate-800/80 hover:bg-cyan-500/10 dark:hover:bg-cyan-500/20 text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 border border-slate-200/80 dark:border-slate-700/80 hover:border-cyan-500/40 transition-all shadow-sm cursor-pointer"
            >
              <span>All Quizzes</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 text-cyan-500" />
            </Link>
          }
        />
        <HomeQuizCarousel />
      </Reveal>

      {/* ── 4. Customer Reviews ────────────────────────────────────── */}
      {/* Owns its own section wrapper — with no active reviews the whole
          block, heading included, drops out of the page. */}
      <HomeReviewsCarousel
        heading={
          <SectionHeading
            eyebrow="Student Reviews"
            title="Trusted by Kerala PSC Aspirants"
            description="Real words from students who prepared with our E-Books, quizzes, and audio lessons."
          />
        }
      />

      {/* ── 5. Social Media ────────────────────────────────────────── */}
      {/* Owns its own section wrapper — with no configured links the whole
          block, heading included, drops out of the page. */}
      <HomeSocialLinks
        heading={
          <SectionHeading
            eyebrow="Stay Connected"
            title="Follow Us Everywhere"
            description="Get daily updates, quick tips, and exclusive content across our official channels."
          />
        }
      />

      {/* ── 6. Frequently Asked Questions ─────────────────────────── */}
      <Reveal as="section">
        <SectionHeading
          eyebrow="Got Questions?"
          title="Frequently Asked Questions"
          description="Everything you need to know about our E-Books, multimedia reader, and preparation materials."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
          {FAQS.map((faq) => (
            <div
              key={faq.question}
              className="group relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-[#1e2e56] bg-white/95 dark:bg-[#0c152e]/90 p-6 sm:p-7 shadow-lg shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/50 hover:shadow-2xl hover:border-cyan-500/40 dark:hover:border-cyan-500/40 hover:-translate-y-1 transition-all duration-300 backdrop-blur-md flex flex-col justify-between"
            >
              {/* Top Accent Gradient Bar on Hover */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-cyan-500 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="space-y-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 transition-transform duration-300 group-hover:scale-110">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg leading-snug group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors pt-0.5">
                    {faq.question}
                  </h3>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal pl-0 sm:pl-[54px]">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ── 7. Aspirant Community & Help Hotline Banner ─────────────── */}
      <Reveal
        as="section"
        className="relative overflow-hidden rounded-3xl sm:rounded-4xl border border-emerald-500/30 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] via-white to-teal-500/[0.08] dark:from-[#061e1a] dark:via-[#09152b] dark:to-[#04131b] p-8 sm:p-14 shadow-2xl shadow-emerald-500/10 dark:shadow-black/60 text-center space-y-6"
      >
        {/* Background glowing aurora orbs */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-emerald-500/15 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-teal-500/15 dark:bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Accent Gradient Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-400" />

        {/* Eyebrow Pill */}
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-sm backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Instant WhatsApp Support &amp; Guidance
          </span>
        </div>

        {/* Headline & Description */}
        <div className="max-w-2xl mx-auto space-y-3 relative z-10">
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
            Need Guidance with Kerala PSC E-Books?
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            Join 25,000+ fellow aspirants or message our dedicated academic support team on WhatsApp for personalized book recommendations, exam strategies, and syllabus walkthroughs.
          </p>
        </div>

        {/* Feature Highlights Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border border-emerald-500/20 shadow-xs backdrop-blur-md">
            <span className="text-emerald-500 font-black">✓</span> Instant WhatsApp Reply
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border border-emerald-500/20 shadow-xs backdrop-blur-md">
            <span className="text-emerald-500 font-black">✓</span> 1-on-1 Book Recommendations
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border border-emerald-500/20 shadow-xs backdrop-blur-md">
            <span className="text-emerald-500 font-black">✓</span> 25,000+ Active Aspirants
          </div>
        </div>

        {/* WhatsApp Action Button */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 relative z-10">
          <a
            href={CONTACT_PHONE_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-sm sm:text-base shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <span>Chat on WhatsApp ({CONTACT_PHONE_DISPLAY})</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </Reveal>
    </div>
  );
}
