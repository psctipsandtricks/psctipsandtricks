import React from 'react';
import Link from 'next/link';
import { Button, Card, Badge } from '@psc/ui';
import {
  Sparkles,
  Trophy,
  BookOpen,
  ArrowRight,
  GraduationCap,
  ListChecks,
  ClipboardCheck,
  BarChart3,
  TrendingUp,
  Globe2,
  Newspaper,
  Landmark,
  Scale,
  Compass,
  FlaskConical,
  Calculator,
  SpellCheck,
  BookText,
  Brain,
  Zap,
  Gem,
  CheckCircle2,
  Music,
  FileText,
  Youtube,
  ShieldCheck,
  Sliders,
  Eye,
  MessageCircle,
  Users,
  FileQuestion,
  HelpCircle,
} from 'lucide-react';
import { StatCounter } from './home-stat-counter';
import { HomeBooksShowcase } from './home-books-showcase';

const CONTACT_PHONE_DISPLAY = '+91 88919 30605';
const CONTACT_PHONE_WHATSAPP = 'https://wa.me/918891930605';

const READER_FEATURES = [
  {
    icon: Music,
    title: 'Teacher Audio Lessons',
    description: 'Listen to experienced teachers explain key concepts alongside your PDF notes, right within the reader.',
    color: 'cyan',
  },
  {
    icon: BookOpen,
    title: 'SCERT Std 5–10 Subdivisions',
    description: 'Complete school textbook syllabus organized into easy chapter subtopics (1.1, 1.2, 1.3) matching PSC questions.',
    color: 'amber',
  },
  {
    icon: Sliders,
    title: 'Voice Clarity DSP',
    description: 'Real-time speech filtering smooths out background noise while you listen, right in the reader.',
    color: 'emerald',
  },
  {
    icon: Youtube,
    title: 'Embedded Video Masterclasses',
    description: 'Topic-wise YouTube video classes embedded directly within reading units for immediate visual clarification.',
    color: 'rose',
  },
  {
    icon: ShieldCheck,
    title: 'Protected Multi-Device Access',
    description: 'Forensically watermarked, distraction-free reading experience optimized for Android, iOS, tablets, and desktop browsers.',
    color: 'indigo',
  },
] as const;

const SUBJECTS = [
  { icon: Landmark, name: 'Kerala History & Renaissance' },
  { icon: Scale, name: 'Indian Constitution & Law' },
  { icon: FlaskConical, name: 'SCERT Basic Science' },
  { icon: Globe2, name: 'Social Science & Geography' },
  { icon: Calculator, name: 'Mathematics & Shortcuts' },
  { icon: Brain, name: 'Mental Ability & Reasoning' },
  { icon: Newspaper, name: 'Current Affairs 2026' },
  { icon: BookText, name: 'Malayalam Grammar & Sahithyam' },
  { icon: SpellCheck, name: 'English Grammar & Vocabulary' },
  { icon: Trophy, name: 'Previous Year Solved Papers' },
] as const;

const STATS = [
  { icon: BookOpen, value: 500, suffix: '+', label: 'E-Book Chapters' },
  { icon: Music, value: 1200, suffix: '+', label: 'Audio Lessons' },
  { icon: Users, value: 25000, suffix: '+', label: 'Active Aspirants' },
  { icon: FileQuestion, value: 10000, suffix: '+', label: 'Practice Questions' },
] as const;

const FAQS = [
  {
    question: 'How do PSC Tips And Tricks E-Books work?',
    answer:
      'Our E-Books are interactive multimedia study modules. Instead of boring static PDFs, each book is broken into structured chapters with audio narrations, SCERT notes, and video classes you can study anywhere.',
  },
  {
    question: 'Can I listen to audio explanations while reading?',
    answer:
      'Yes! Every topic includes a teacher audio lesson you can play alongside your notes, and you can toggle Voice Clarity to filter background noise.',
  },
  {
    question: 'Are SCERT textbooks from Class 5 to 10 covered?',
    answer:
      'Yes. We provide complete SCERT Basic Science and Social Science subdivisions mapped line-by-line to the Kerala PSC 10th Level, Plus Two, and Degree Level syllabi.',
  },
  {
    question: 'Can I read the books on mobile phones and tablets?',
    answer:
      'Yes. Our reader is fully responsive and optimized for mobile screens with dark mode, single-unit fast loading, and touch-friendly controls.',
  },
  {
    question: 'Are there also practice quizzes available?',
    answer:
      'Yes. After studying each E-book chapter, you can test your retention with our minimal daily quizzes and previous-year mock tests.',
  },
  {
    question: 'How do I get help if I have payment or access questions?',
    answer:
      'You can reach our student support team directly via WhatsApp or phone at +91 88919 30605 for instant assistance.',
  },
] as const;

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; shadow: string }> = {
  cyan: { bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', text: 'text-cyan-500', shadow: 'hover:shadow-cyan-500/10' },
  amber: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-500', shadow: 'hover:shadow-amber-500/10' },
  indigo: { bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', text: 'text-indigo-500', shadow: 'hover:shadow-indigo-500/10' },
  emerald: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-500', shadow: 'hover:shadow-emerald-500/10' },
  rose: { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-500', shadow: 'hover:shadow-rose-500/10' },
};

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="max-w-2xl mx-auto text-center space-y-3 mb-10 sm:mb-12">
      <Badge variant="gold" className="text-[11px] uppercase tracking-widest px-3 py-1">
        {eyebrow}
      </Badge>
      <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
        {title}
      </h2>
      {description && (
        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed">{description}</p>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-20 sm:space-y-28 py-4">
      {/* ── 1. Hero Section (E-Book Centric) ─────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl glass-panel p-6 sm:p-14 flex flex-col lg:flex-row items-center justify-between gap-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 ambient-glow-amber rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 ambient-glow-cyan rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-6 max-w-2xl relative z-10 text-center lg:text-left reveal-fade-up">
          <div className="flex items-center gap-2 justify-center lg:justify-start text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <BookOpen className="w-4 h-4 text-amber-500" />
            <span>PSC Multimedia E-Books</span>
          </div>

          <Badge variant="gold" className="text-xs uppercase tracking-widest px-3.5 py-1 inline-flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Kerala PSC 2026 Study Material</span>
          </Badge>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight text-slate-900 dark:text-white">
            Master Kerala PSC with{' '}
            <span className="bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-500 bg-clip-text text-transparent">
              Smart Multimedia E-Books
            </span>
          </h1>

          <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed font-medium">
            Study SCERT Class 5–10 textbook notes with audio teacher explanations, video lessons,
            and memory shortcuts designed specifically for Kerala PSC top-rank preparation.
          </p>

          <div className="flex flex-wrap gap-3 pt-2 justify-center lg:justify-start">
            <Link href="/books">
              <Button size="lg" variant="gold" className="font-extrabold shadow-lg shadow-amber-500/20 px-6">
                <BookOpen className="w-4 h-4 mr-2" />
                Browse PSC E-Books
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/books">
              <Button size="lg" variant="primary" className="font-bold">
                <Music className="w-4 h-4 mr-2" />
                Try Audio Reader
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 justify-center lg:justify-start text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Teacher Audio Lessons
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> SCERT Class 5–10 Mapped
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Mobile & Tablet Ready
            </span>
          </div>
        </div>

        {/* E-Book 3D Preview Highlight Card */}
        <div className="w-full max-w-sm glass-card p-6 border-slate-200/80 dark:border-slate-800/80 relative z-10 shadow-xl reveal-fade-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Featured E-Book</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              AUDIO ENABLED
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3 items-center">
              <div className="w-16 h-20 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-0.5 shadow-md shrink-0 flex items-center justify-center text-white">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400">SCERT Series</p>
                <h4 className="text-sm font-black text-slate-900 dark:text-white truncate leading-snug">
                  NEW SCERT Basic Science & Social Science (STD 5–10)
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Chapters 1–10 with Audio Notes</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-slate-100/70 dark:bg-[#070e22]/70 text-xs">
              <div className="flex items-center gap-2">
                <Music className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Voice Clarity</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">PDF Notes</span>
              </div>
            </div>

            <Link href="/books" className="block">
              <Button className="w-full font-bold shadow-md shadow-amber-500/20" variant="gold">
                <span>Start Reading Now</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 2. Featured E-Books Showcase Catalog ───────────────────── */}
      <section id="books-catalog">
        <SectionHeading
          eyebrow="PSC E-Book Catalog"
          title="Curated Study Materials & Standard E-Books"
          description="Explore our complete library of PSC exam preparation books with audio narrations, diagrams, and topic notes."
        />
        <HomeBooksShowcase />
      </section>

      {/* ── 3. Multimedia Reader Advantage (Why Our E-Books Excel) ── */}
      <section>
        <SectionHeading
          eyebrow="Multimedia E-Book Reader"
          title="A revolutionary way to study for Kerala PSC"
          description="Built from the ground up to help you absorb, retain, and revise complex topics 3x faster."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {READER_FEATURES.map((feat) => {
            const colors = COLOR_CLASSES[feat.color];
            return (
              <Card
                key={feat.title}
                className={`space-y-3 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${colors.shadow}`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl ${colors.bg} border ${colors.border} ${colors.text} flex items-center justify-center shadow-md`}
                >
                  <feat.icon className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">{feat.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{feat.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── 4. Subjects Covered Across Our E-Books ─────────────────── */}
      <section>
        <SectionHeading
          eyebrow="Syllabus Coverage"
          title="Covering every PSC topic from syllabus to exam day"
          description="Comprehensive topic-wise notes for LDC, LGS, Secretariat Assistant, and Degree Level examinations."
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {SUBJECTS.map((subject) => (
            <Link
              key={subject.name}
              href="/books"
              className="glass-card p-5 flex flex-col items-center text-center gap-3 group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-amber-500/10"
            >
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <subject.icon className="w-5 h-5" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug">
                {subject.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 5. Stats / Achievement Counters ─────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl glass-panel p-8 sm:p-12">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] ambient-glow-amber rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center">
                <stat.icon className="w-6 h-6" />
              </div>
              <p className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono">
                <StatCounter value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. Secondary & Minimal Quiz Section (Secondary Accent) ──── */}
      <section className="rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-[#0c152e] dark:via-[#091124] dark:to-[#0c152e] p-6 sm:p-8 shadow-md">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left max-w-xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              <FileQuestion className="w-3.5 h-3.5" />
              <span>Quick Revision & Quizzes</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Test your knowledge after reading
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Reinforce what you studied in the E-Books with 10,000+ topic-wise practice questions and live mock tests.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-semibold text-slate-500 dark:text-slate-400 justify-center md:justify-start">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Free Daily Quizzes
              </span>
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Live Rank Lists
              </span>
            </div>
          </div>

          <div className="shrink-0">
            <Link href="/quizzes">
              <Button size="lg" variant="outline" className="font-bold border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10">
                <span>Browse Quizzes & Mocks</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 7. Frequently Asked Questions ─────────────────────────── */}
      <section>
        <SectionHeading
          eyebrow="Got Questions?"
          title="Frequently Asked Questions"
          description="Everything you need to know about our E-Books, multimedia reader, and preparation materials."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
          {FAQS.map((faq) => (
            <Card key={faq.question} className="space-y-2 p-6">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-start gap-2.5">
                <HelpCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <span>{faq.question}</span>
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-7.5">{faq.answer}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── 8. Aspirant Community & Help Hotline Banner ─────────────── */}
      <section className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-amber-500/10 p-8 sm:p-12 text-center space-y-5">
        <div className="max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            Need Guidance with Kerala PSC E-Books?
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Join 25,000+ fellow aspirants or message our support team on WhatsApp for book recommendations and syllabus guidance.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <a href={CONTACT_PHONE_WHATSAPP} target="_blank" rel="noopener noreferrer">
            <Button size="lg" variant="gold" className="font-bold shadow-md shadow-emerald-500/20">
              <MessageCircle className="w-4 h-4 mr-2" />
              Chat on WhatsApp ({CONTACT_PHONE_DISPLAY})
            </Button>
          </a>
        </div>
      </section>
    </div>
  );
}
