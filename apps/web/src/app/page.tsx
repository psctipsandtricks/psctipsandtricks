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
  RefreshCw,
  Target,
  Repeat,
  Swords,
  UserPlus,
  PenLine,
  Bell,
  MessageCircle,
  Phone,
  Users,
  FileQuestion,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { StatCounter } from './home-stat-counter';

const CONTACT_PHONE_DISPLAY = '+91 88919 30605';
const CONTACT_PHONE_TEL = '+918891930605';
const CONTACT_PHONE_WHATSAPP = 'https://wa.me/918891930605';

const PILLARS = [
  {
    icon: BookOpen,
    title: 'Learn',
    description: 'Study curated notes, e-books, and topic-wise shortcuts built around the real Kerala PSC syllabus.',
    color: 'cyan',
  },
  {
    icon: ListChecks,
    title: 'Practice',
    description: 'Work through 10,000+ topic-wise questions with instant, detailed explanations for every answer.',
    color: 'amber',
  },
  {
    icon: ClipboardCheck,
    title: 'Take Mock Tests',
    description: 'Simulate the real exam with timed mock tests that follow the official negative-marking pattern.',
    color: 'indigo',
  },
  {
    icon: BarChart3,
    title: 'Track Performance',
    description: 'See your accuracy, attempt history, and strong vs. weak topics on a personal dashboard.',
    color: 'emerald',
  },
  {
    icon: TrendingUp,
    title: 'Improve Your Rank',
    description: 'Compare with fellow aspirants on live rank lists and climb higher with every attempt.',
    color: 'rose',
  },
] as const;

const SUBJECTS = [
  { icon: Globe2, name: 'General Knowledge' },
  { icon: Newspaper, name: 'Current Affairs' },
  { icon: Landmark, name: 'Kerala History' },
  { icon: Scale, name: 'Indian Constitution' },
  { icon: Compass, name: 'Geography' },
  { icon: FlaskConical, name: 'Science' },
  { icon: Calculator, name: 'Mathematics' },
  { icon: SpellCheck, name: 'English' },
  { icon: BookText, name: 'Malayalam' },
  { icon: Brain, name: 'Mental Ability' },
] as const;

const MOCK_TEST_FEATURES = [
  {
    icon: PenLine,
    title: 'Practice Tests',
    description: 'Unlimited topic-wise practice with no time pressure — perfect for building fundamentals.',
  },
  {
    icon: Zap,
    title: 'Live Mock Tests',
    description: 'Scheduled, exam-like tests with a live countdown so you get used to real exam pressure.',
  },
  {
    icon: Gem,
    title: 'Premium Quizzes',
    description: 'Expert-curated, previous-year-pattern question sets for serious, focused preparation.',
  },
  {
    icon: BarChart3,
    title: 'Performance Analysis',
    description: 'A breakdown of accuracy, time spent, and topic-wise strengths after every attempt.',
  },
  {
    icon: Trophy,
    title: 'Rank Lists',
    description: 'Real-time percentile and rank calculation so you know exactly where you stand.',
  },
] as const;

const WHY_CHOOSE_US = [
  {
    icon: GraduationCap,
    title: 'Expert-Guided Preparation',
    description: 'Content structured around what actually matters for Kerala PSC — not generic study material.',
  },
  {
    icon: RefreshCw,
    title: 'Regularly Updated Questions',
    description: 'Our question bank keeps growing, so you always have fresh material to practice with.',
  },
  {
    icon: Target,
    title: 'Exam-Focused Content',
    description: 'Every quiz and mock test is built around the real Kerala PSC exam pattern and syllabus.',
  },
  {
    icon: Repeat,
    title: 'Regular Practice, Real Progress',
    description: 'Short daily quizzes make consistent revision easy to stick with instead of overwhelming.',
  },
  {
    icon: BarChart3,
    title: 'Detailed Performance Tracking',
    description: 'A dashboard that shows exactly what to revise next, not just a final score.',
  },
  {
    icon: Swords,
    title: 'Competitive Mock Tests',
    description: 'Live rank lists turn revision into healthy competition with aspirants across Kerala.',
  },
] as const;

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: UserPlus,
    title: 'Create Your Free Account',
    description: 'Sign up in under a minute — no payment required to get started.',
  },
  {
    step: '02',
    icon: BookOpen,
    title: 'Learn & Practice Topic-wise',
    description: 'Work through subject-wise quizzes and e-books at your own pace.',
  },
  {
    step: '03',
    icon: ClipboardCheck,
    title: 'Take Mock Tests',
    description: 'Attempt timed mock tests that mirror the real Kerala PSC exam experience.',
  },
  {
    step: '04',
    icon: TrendingUp,
    title: 'Track Rank & Improve',
    description: 'Review your dashboard, spot weak topics, and climb the rank list next attempt.',
  },
] as const;

const STATS = [
  { icon: FileQuestion, value: 10000, suffix: '+', label: 'Practice Questions' },
  { icon: ClipboardCheck, value: 500, suffix: '+', label: 'Mock Tests' },
  { icon: Users, value: 25000, suffix: '+', label: 'Students Preparing' },
  { icon: BookOpen, value: 300, suffix: '+', label: 'Study Resources' },
] as const;

const FAQS = [
  {
    question: 'Is PSC Tips And Tricks free to use?',
    answer:
      'Yes. A large part of our question bank, quizzes, and study material is completely free. Some premium quizzes, mock tests, and e-books are available as a one-time purchase for students who want deeper, exam-focused practice.',
  },
  {
    question: 'Do you provide live mock tests with rank lists?',
    answer:
      'Yes. Live mock tests run on a schedule with a real countdown, and every submission is scored instantly with a live, real-time rank list so you can see exactly where you stand among other aspirants.',
  },
  {
    question: 'Can I access previous year question papers?',
    answer:
      'Yes. Our e-book library includes topic-wise previous year question papers with detailed, step-by-step explanations and quick memory tricks for faster revision.',
  },
  {
    question: 'How does negative marking work in mock tests?',
    answer:
      'Mock tests follow the negative-marking pattern set for each exam, similar to the official Kerala PSC scheme, so you get used to answering carefully under real exam conditions.',
  },
  {
    question: 'Can I discuss doubts with other aspirants?',
    answer:
      'Yes. Our Community section has topic-wise study circles where you can ask questions, discuss current affairs, and get updates directly from admins and fellow students.',
  },
  {
    question: 'How do I track my performance and rank?',
    answer:
      'Every quiz and mock test attempt updates your personal dashboard — accuracy, attempt history, and topic-wise performance — plus a rank list for every mock test you take.',
  },
  {
    question: 'Which subjects and exams are covered?',
    answer:
      'We cover the full Kerala PSC syllabus — General Knowledge, Current Affairs, Kerala History, Indian Constitution, Geography, Science, Mathematics, English, Malayalam, and Mental Ability — alongside preparation material for SSC and UPSC.',
  },
] as const;

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; shadow: string }> = {
  cyan: { bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', text: 'text-cyan-500', shadow: 'hover:shadow-cyan-500/10' },
  amber: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-500', shadow: 'hover:shadow-amber-500/10' },
  indigo: { bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', text: 'text-indigo-500', shadow: 'hover:shadow-indigo-500/10' },
  emerald: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-500', shadow: 'hover:shadow-emerald-500/10' },
  rose: { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-500', shadow: 'hover:shadow-rose-500/10' },
};

/** Small section heading used consistently across the page. */
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
      {/* ── Hero Section ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl glass-panel p-6 sm:p-14 flex flex-col lg:flex-row items-center justify-between gap-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 ambient-glow-amber rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 ambient-glow-indigo rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-6 max-w-2xl relative z-10 text-center lg:text-left reveal-fade-up">
          <div className="flex items-center gap-2 justify-center lg:justify-start text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>PSC Tips And Tricks</span>
          </div>
          <Badge variant="gold" className="text-xs uppercase tracking-widest px-3.5 py-1 inline-flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Kerala PSC 2026 Preparation</span>
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight text-slate-900 dark:text-white">
            Crack Kerala PSC Exams with{' '}
            <span className="bg-gradient-to-r from-amber-500 via-amber-400 to-cyan-500 bg-clip-text text-transparent">
              Smart Practice & Live Mocks
            </span>
          </h1>
          <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed font-medium">
            Learn, practice, and take mock tests built around the real Kerala PSC syllabus — General Knowledge,
            Current Affairs, Kerala History, Constitution, and more — with instant rank lists to track every step
            of your progress.
          </p>
          <div className="flex flex-wrap gap-3 pt-2 justify-center lg:justify-start">
            <Link href="/signup">
              <Button size="lg" variant="gold" className="font-bold shadow-lg shadow-cyan-500/20">
                Start Learning
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/quizzes">
              <Button size="lg" variant="primary" className="font-bold">
                Take a Mock Test
              </Button>
            </Link>
            <Link href="/quizzes">
              <Button size="lg" variant="outline" className="font-semibold">
                Explore Quizzes
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 justify-center lg:justify-start text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Free to get started
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Live rank lists
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Kerala PSC syllabus focused
            </span>
          </div>
        </div>

        {/* Platform snapshot card */}
        <div className="w-full max-w-sm glass-card p-6 border-slate-200/80 dark:border-slate-800/80 relative z-10 shadow-xl reveal-fade-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center space-x-1.5">
              <Trophy className="w-3.5 h-3.5" />
              <span>Platform at a Glance</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                  <stat.icon className="w-3.5 h-3.5" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                  <StatCounter value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-snug">{stat.label}</p>
              </div>
            ))}
          </div>
          <Link href="/quizzes" className="block mt-5">
            <Button className="w-full font-bold" variant="primary">
              <span>Join the Next Mock Test</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Platform Pillars: Learn → Practice → Mock Test → Track → Rank ── */}
      <section>
        <SectionHeading
          eyebrow="How PSC Tips And Tricks Helps"
          title="Everything you need, in one preparation journey"
          description="A single platform to move from learning the syllabus to walking into the exam hall with confidence."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {PILLARS.map((pillar) => {
            const colors = COLOR_CLASSES[pillar.color];
            return (
              <Card
                key={pillar.title}
                className={`space-y-3 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${colors.shadow}`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl ${colors.bg} border ${colors.border} ${colors.text} flex items-center justify-center shadow-md`}
                >
                  <pillar.icon className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base">{pillar.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{pillar.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── Stats / Achievement Counters ─────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl glass-panel p-8 sm:p-12">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] ambient-glow-cyan rounded-full blur-3xl pointer-events-none" />
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

      {/* ── Kerala PSC Exam Preparation: Subjects ────────────────── */}
      <section>
        <SectionHeading
          eyebrow="Kerala PSC Exam Preparation"
          title="Covering every subject the exam actually tests"
          description="Focused practice across the full Kerala PSC syllabus, so nothing catches you off guard on exam day."
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {SUBJECTS.map((subject) => (
            <Link
              key={subject.name}
              href="/quizzes"
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

      {/* ── Mock Test & Quiz Section ──────────────────────────────── */}
      <section>
        <SectionHeading
          eyebrow="Mock Tests & Quizzes"
          title="Practice like it's exam day"
          description="From casual topic-wise practice to full-length live mock tests with real-time rank lists."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {MOCK_TEST_FEATURES.map((feature) => (
            <Card
              key={feature.title}
              hoverEffect
              className="space-y-3 transition-all duration-300 hover:-translate-y-1.5"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-500 flex items-center justify-center shadow-md">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">{feature.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{feature.description}</p>
            </Card>
          ))}
        </div>
        <div className="flex justify-center mt-8">
          <Link href="/quizzes">
            <Button size="lg" variant="gold" className="font-bold">
              Browse Quizzes & Mock Tests
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Why Choose Us ─────────────────────────────────────────── */}
      <section>
        <SectionHeading
          eyebrow="Why Choose Us"
          title="Built specifically for Kerala PSC aspirants"
          description="Not a generic quiz app — every feature is designed around what it actually takes to clear the exam."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {WHY_CHOOSE_US.map((item) => (
            <Card
              key={item.title}
              className="space-y-3 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-emerald-500/10"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shadow-md">
                <item.icon className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">{item.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{item.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl glass-panel p-8 sm:p-14">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40rem] h-64 ambient-glow-amber rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <SectionHeading
            eyebrow="How It Works"
            title="From sign-up to your first mock test rank"
            description="A simple, four-step journey — no confusing setup, just straightforward exam preparation."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Connecting line for desktop */}
            <div className="hidden lg:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} className="relative text-center space-y-3">
                <div className="relative z-10 w-12 h-12 mx-auto rounded-2xl bg-white dark:bg-[#0c152e] border-2 border-amber-500/40 text-amber-500 flex items-center justify-center font-black shadow-md">
                  <step.icon className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  STEP {step.step}
                </Badge>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">{step.title}</h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Latest Updates / Notifications ───────────────────────── */}
      <section>
        <SectionHeading
          eyebrow="Stay Updated"
          title="Never miss a Kerala PSC notification"
          description="Exam calendars, current affairs digests, and official announcements — shared as they're released."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="space-y-3 transition-all duration-300 hover:-translate-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Exam Notifications</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Admin-posted alerts on upcoming Kerala PSC notifications and exam calendars, right inside the platform.
            </p>
          </Card>
          <Card className="space-y-3 transition-all duration-300 hover:-translate-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-500 flex items-center justify-center">
              <Newspaper className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Current Affairs Digest</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Regularly refreshed current affairs quizzes so your general knowledge stays exam-ready.
            </p>
          </Card>
          <Card className="space-y-3 transition-all duration-300 hover:-translate-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Community Announcements</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Join topic-wise study circles in the Community to get updates and discuss with fellow aspirants.
            </p>
          </Card>
        </div>
        <div className="flex justify-center mt-8">
          <Link href="/community">
            <Button size="lg" variant="outline" className="font-semibold">
              Visit the Community
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section>
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently asked questions"
          description="Everything Kerala PSC aspirants usually ask before getting started."
        />
        <div className="max-w-3xl mx-auto space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group glass-card p-5 [&_summary::-webkit-details-marker]:hidden transition-all duration-300"
            >
              <summary className="flex items-center justify-between gap-4 cursor-pointer font-bold text-slate-900 dark:text-white text-sm sm:text-base list-none">
                <span className="flex items-center gap-3">
                  <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  {faq.question}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 group-open:rotate-90" />
              </summary>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-3 pl-7">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950 dark:from-[#050a16] dark:via-[#050a16] dark:to-cyan-950 p-8 sm:p-16 text-center shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 ambient-glow-amber rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 ambient-glow-cyan rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <Badge
            variant="gold"
            className="text-xs uppercase tracking-widest px-3.5 py-1 !bg-amber-500/15 !text-amber-300 !border-amber-400/40"
          >
            Your Kerala PSC Journey Starts Here
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Start your Kerala PSC preparation today
          </h2>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            Join thousands of aspirants learning, practicing, and taking mock tests every day. Your next rank list
            could have your name at the top.
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-2">
            <Link href="/signup">
              <Button size="lg" variant="gold" className="font-bold shadow-lg shadow-amber-500/20">
                Get Started for Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/quizzes">
              <Button
                size="lg"
                variant="outline"
                className="font-semibold !bg-white/10 !text-white !border-white/30 hover:!bg-white/20"
              >
                Explore Quizzes
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Contact ───────────────────────────────────────────────── */}
      <section id="contact" className="glass-panel rounded-3xl p-8 sm:p-12">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="text-center lg:text-left space-y-2">
            <Badge variant="gold" className="text-[11px] uppercase tracking-widest px-3 py-1">
              Contact Us
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Have a question about your preparation?
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base max-w-lg">
              Reach out to our team directly — we're happy to help with courses, payments, or anything else.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <a
              href={`tel:${CONTACT_PHONE_TEL}`}
              className="flex items-center gap-3 px-5 py-3.5 rounded-2xl glass-card hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-500 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Call Us</p>
                <p className="font-black text-slate-900 dark:text-white font-mono">{CONTACT_PHONE_DISPLAY}</p>
              </div>
            </a>
            <a
              href={CONTACT_PHONE_WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 py-3.5 rounded-2xl glass-card hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">WhatsApp</p>
                <p className="font-black text-slate-900 dark:text-white font-mono">{CONTACT_PHONE_DISPLAY}</p>
              </div>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
