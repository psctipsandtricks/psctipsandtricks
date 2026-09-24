import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Button } from '@psc/ui';
import {
  Target,
  Compass,
  Sparkles,
  BookOpen,
  Headphones,
  Trophy,
  Video,
  Smartphone,
  Users,
  ShieldCheck,
  Award,
  CheckCircle2,
  ArrowRight,
  MessageCircle,
  GraduationCap,
  HeartHandshake,
  Layers,
} from 'lucide-react';
import { Reveal } from '../reveal';
import { HomeSocialLinks } from '../home-social-links';

export const metadata: Metadata = {
  title: 'About Us — PSC Tips And Tricks | Kerala PSC Exam Preparation Platform',
  description:
    'Learn about PSC Tips And Tricks, our mission, vision, and comprehensive multimedia learning ecosystem designed for Kerala PSC and competitive exam aspirants.',
};

const CONTACT_PHONE_DISPLAY = '+91 88919 30605';
const CONTACT_PHONE_WHATSAPP = 'https://wa.me/918891930605';

const STATS = [
  { label: 'Active Aspirants', value: '50,000+', description: 'Students learning across Kerala' },
  { label: 'High-Yield E-Books', value: '100+', description: 'Interactive chapter modules & notes' },
  { label: 'Mock Tests & Quizzes', value: '1,000+', description: 'Topic exams with live rank tracking' },
  { label: 'Learner Rating', value: '4.9★', description: 'Average student satisfaction' },
] as const;

const CORE_VALUES = [
  {
    icon: ShieldCheck,
    title: 'Syllabus Precision & Accuracy',
    description:
      'Every chapter, note, and quiz is curated by our editorial board following official Kerala PSC, SCERT, and NCERT guidelines.',
    tint: 'from-cyan-500/20 to-blue-500/20 text-cyan-500 dark:text-cyan-400 border-cyan-500/30',
  },
  {
    icon: Sparkles,
    title: 'Multi-Modal Learning',
    description:
      'We combine structured text notes with teacher audio narrations, diagrams, and video walkthroughs to maximize memory retention.',
    tint: 'from-amber-500/20 to-orange-500/20 text-amber-500 dark:text-amber-400 border-amber-500/30',
  },
  {
    icon: HeartHandshake,
    title: 'Affordable & Accessible to All',
    description:
      'Quality coaching shouldn’t be a luxury. We provide high-standard education at affordable pricing with offline mobile support.',
    tint: 'from-emerald-500/20 to-teal-500/20 text-emerald-500 dark:text-emerald-400 border-emerald-500/30',
  },
  {
    icon: Trophy,
    title: 'Result-Oriented Practice',
    description:
      'Timed mock tests, real-time rank lists, negative marking calculations, and detailed solution reviews built for exam success.',
    tint: 'from-violet-500/20 to-purple-500/20 text-violet-500 dark:text-violet-400 border-violet-500/30',
  },
] as const;

const SERVICES = [
  {
    icon: BookOpen,
    title: 'Interactive E-Books & Chapter Notes',
    description:
      'Syllabus-aligned books divided into focused topics with key takeaways, Malayalam explanations, exam points, and visual tables.',
    badge: 'Core Feature',
    href: '/books',
    actionLabel: 'Browse E-Books',
  },
  {
    icon: Headphones,
    title: 'Teacher Audio Lessons & Narrations',
    description:
      'Listen to chapter explanations and memory mnemonics while reading or on the move. Built-in audio player with background playback.',
    badge: 'Audio Learning',
    href: '/books',
    actionLabel: 'Explore Audio Books',
  },
  {
    icon: Trophy,
    title: 'Timed Mock Tests & Live Rank Lists',
    description:
      'Full-length and topic-wise mock exams that simulate real Kerala PSC tests, showing instant percentile, rank, and score breakdown.',
    badge: 'Test Series',
    href: '/quizzes',
    actionLabel: 'Go to Quiz Hub',
  },
  {
    icon: Video,
    title: 'Curated Video Classes & Document Vault',
    description:
      'Organized video lectures and high-yield revision PDFs arranged chapter-wise for easy access on web and mobile devices.',
    badge: 'Classroom',
    href: '/quizzes',
    actionLabel: 'Watch Classes',
  },
  {
    icon: Smartphone,
    title: 'Official Mobile App with Offline Study Vault',
    description:
      'Download books, audio narrations, and revision notes to your mobile device for offline study with zero mobile data consumption.',
    badge: 'Mobile App',
    href: '#social-links',
    actionLabel: 'Get the App',
  },
  {
    icon: Users,
    title: 'Student Community & Study Circles',
    description:
      'Collaborate with fellow PSC aspirants, participate in daily quiz challenges, and receive instant exam notification updates.',
    badge: 'Community',
    href: '/community',
    actionLabel: 'Join Community',
  },
] as const;

const EXAMS_COVERED = [
  'Kerala PSC 10th Level Prelims & Mains (LDC, VFA, LGS, Field Worker)',
  'Kerala PSC 12th Level Prelims & Mains (Civil Police Officer, Fireman, BEVCO)',
  'Kerala PSC Degree Level Prelims & Mains (Secretariat Assistant, University Assistant, Sub Inspector)',
  'Kerala Administrative Service (KAS) & Departmental Tests',
  'Staff Selection Commission (SSC CGL, CHSL, MTS, GD Constable)',
  'Subject-wise Modules: General Knowledge, Kerala History, Malayalam, English, Maths & Mental Ability',
] as const;

export default function AboutPage() {
  return (
    <div className="space-y-16 sm:space-y-24 py-6 sm:py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* ── 1. Hero Section ────────────────────────────────────────── */}
      <Reveal as="section" className="text-center space-y-6 max-w-4xl mx-auto pt-4 sm:pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border border-cyan-500/30">
          <GraduationCap className="w-3.5 h-3.5" />
          <span>About PSC Tips And Tricks</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.15]">
          Empowering Kerala PSC Aspirants with{' '}
          <span className="bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 bg-clip-text text-transparent">
            Smart, Tech-Driven
          </span>{' '}
          Preparation
        </h1>

        <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl mx-auto">
          PSC Tips And Tricks is Kerala’s dedicated ed-tech learning platform built to help government job aspirants learn
          faster, retain more, and rank higher through structured multimedia e-books, teacher audio lessons, and real-time
          mock exams.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
          <Link href="/books">
            <Button variant="primary" className="gap-2 shadow-lg shadow-cyan-500/25">
              <BookOpen className="w-4 h-4" />
              <span>Explore E-Books</span>
            </Button>
          </Link>
          <Link href="/quizzes">
            <Button variant="secondary" className="gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Practice Mock Tests</span>
            </Button>
          </Link>
          <a
            href={CONTACT_PHONE_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-emerald-500" />
            <span>WhatsApp Support</span>
          </a>
        </div>
      </Reveal>

      {/* ── 2. Key Stats / Trust Numbers ────────────────────────────── */}
      <Reveal as="section">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {STATS.map((item, idx) => (
            <div
              key={idx}
              className="glass-card p-5 sm:p-6 rounded-2xl sm:rounded-3xl text-center space-y-1 sm:space-y-2 border border-slate-200/80 dark:border-slate-800/80 hover:-translate-y-1 transition-transform"
            >
              <div className="text-2xl sm:text-4xl font-black bg-gradient-to-r from-cyan-500 to-indigo-500 bg-clip-text text-transparent">
                {item.value}
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                {item.label}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ── 3. Mission & Vision Grid ────────────────────────────────── */}
      <Reveal as="section" className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <Badge variant="gold" className="text-[10px] sm:text-[11px] uppercase tracking-widest px-3 py-1">
            Our Purpose
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">
            Mission &amp; Vision
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Guiding every student in Kerala towards academic excellence and public service success.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {/* Mission Card */}
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-10 glass-panel border border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 via-slate-900/5 to-transparent space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500 dark:text-cyan-400">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Our Mission
            </h3>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              To deliver structured, exam-oriented, and multimedia study resources that eliminate clutter, emphasize
              high-yield concepts, and empower aspirants to master complex Kerala PSC syllabi with confidence, clarity, and
              speed.
            </p>
            <ul className="space-y-2.5 pt-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" />
                <span>Bite-sized, digestible topic breakdowns with Malayalam notes</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" />
                <span>Integrated audio narrations to study during commutes and work</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" />
                <span>Continuous exam simulations with negative marking &amp; rank predictions</span>
              </li>
            </ul>
          </div>

          {/* Vision Card */}
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 lg:p-10 glass-panel border border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 via-slate-900/5 to-transparent space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Our Vision
            </h3>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              To become Kerala’s most trusted, accessible, and technologically advanced learning ecosystem for government
              competitive examinations — bridging geographic and economic barriers so that talent and hard work alone
              determine success.
            </p>
            <ul className="space-y-2.5 pt-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Democratizing top-tier PSC guidance across all 14 districts</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Leveraging offline-first mobile tech so every student can study without data limits</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>Fostering a supportive student community driven by discipline and shared goals</span>
              </li>
            </ul>
          </div>
        </div>
      </Reveal>

      {/* ── 4. Our Story / Who We Are ───────────────────────────────── */}
      <Reveal as="section" className="glass-panel p-6 sm:p-10 lg:p-12 rounded-3xl sm:rounded-4xl border border-slate-200/80 dark:border-slate-800/80 space-y-6">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center">
          <div className="space-y-4 flex-1">
            <Badge variant="default" className="text-[10px] sm:text-[11px] uppercase tracking-widest px-3 py-1">
              Who We Are
            </Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white leading-tight">
              A Dedicated Team of Educators, Subject Experts &amp; Tech Innovators
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Started as a passion project to simplify cumbersome PSC textbooks and scattered study materials,{' '}
              <strong>PSC Tips And Tricks</strong> has grown into an all-in-one learning platform. We recognized that most
              students fail not due to lack of effort, but due to information overload and lack of structured retention
              techniques.
            </p>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Our content editorial board continuously analyzes previous years’ question papers, Kerala Gazette notifications,
              and evolving syllabus weightages to produce books and mock tests that mirror actual exam patterns.
            </p>
          </div>

          <div className="w-full lg:w-96 shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                <Award className="w-4 h-4 text-cyan-500" />
                <span>Expert Editorial Board</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Researched and vetted by seasoned Kerala PSC subject specialists.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>SCERT &amp; NCERT Aligned</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                100% syllabus alignment with state and national curriculum standards.
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                <Smartphone className="w-4 h-4 text-emerald-500" />
                <span>Multi-Platform Access</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Seamless learning across responsive Web, Android, and iOS devices.
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ── 5. Core Values ──────────────────────────────────────────── */}
      <Reveal as="section" className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <Badge variant="default" className="text-[10px] sm:text-[11px] uppercase tracking-widest px-3 py-1">
            Our Foundation
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">
            Core Values We Live By
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Principles that guide every study material we publish and every feature we build.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {CORE_VALUES.map((val, idx) => {
            const Icon = val.icon;
            return (
              <div
                key={idx}
                className="glass-card p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-4 hover:-translate-y-1.5 transition-all shadow-lg"
              >
                <div className="space-y-3">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br border flex items-center justify-center ${val.tint}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                    {val.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {val.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>

      {/* ── 6. Our Services / What We Offer ─────────────────────────── */}
      <Reveal as="section" className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <Badge variant="gold" className="text-[10px] sm:text-[11px] uppercase tracking-widest px-3 py-1">
            What We Offer
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">
            Our Comprehensive Learning Services
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Everything an aspirant needs under one unified roof to prepare effectively from Day 1 to the final rank list.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((serv, idx) => {
            const Icon = serv.icon;
            return (
              <div
                key={idx}
                className="group glass-card p-6 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-5 hover:-translate-y-1.5 transition-all shadow-lg hover:shadow-cyan-500/10 hover:border-cyan-500/40"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500 dark:text-cyan-400 group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                      {serv.badge}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors">
                    {serv.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {serv.description}
                  </p>
                </div>

                <Link
                  href={serv.href}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-cyan-500 dark:text-cyan-400 hover:text-cyan-600 transition-colors pt-2 group-hover:translate-x-1 duration-300"
                >
                  <span>{serv.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </Reveal>

      {/* ── 7. Exam Categories Covered ──────────────────────────────── */}
      <Reveal as="section" className="glass-panel p-6 sm:p-10 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <Badge variant="default" className="text-[10px] sm:text-[11px] uppercase tracking-widest px-3 py-1">
            Exam Coverage
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            Exams Supported on PSC Tips And Tricks
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Tailored study modules covering all major recruitments published by the Kerala Public Service Commission.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 max-w-4xl mx-auto pt-2">
          {EXAMS_COVERED.map((exam, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-xs sm:text-sm text-slate-800 dark:text-slate-200"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="font-medium leading-snug">{exam}</span>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ── 8. Official Social & App Links ─────────────────────────── */}
      <HomeSocialLinks
        heading={
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <Badge variant="gold" className="text-[10px] sm:text-[11px] uppercase tracking-widest px-3 py-1">
              Join Our Community
            </Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">
              Connect with PSC Tips And Tricks
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Join thousands of fellow aspirants on Telegram, YouTube, and Instagram for daily notes, live tests, and updates.
            </p>
          </div>
        }
      />

      {/* ── 9. Direct Contact & Support CTA ────────────────────────── */}
      <Reveal as="section" className="relative overflow-hidden rounded-3xl sm:rounded-4xl border border-cyan-500/30 bg-gradient-to-br from-[#0c1a3a] via-[#091124] to-[#061224] p-8 sm:p-12 text-center text-white shadow-2xl">
        <div className="max-w-2xl mx-auto space-y-4 relative z-10">
          <Badge variant="default" className="text-[10px] uppercase tracking-widest px-3 py-1">
            Need Help or Have Questions?
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
            We Are Here to Guide Your PSC Journey
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl mx-auto">
            Have questions about book purchases, study materials, or app usage? Reach out directly to our student support
            desk via WhatsApp.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <a
              href={CONTACT_PHONE_WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-extrabold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Chat on WhatsApp ({CONTACT_PHONE_DISPLAY})</span>
            </a>
            <Link href="/books">
              <Button variant="secondary" className="px-6 py-3 rounded-2xl text-sm font-extrabold">
                Browse Books Catalog
              </Button>
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
