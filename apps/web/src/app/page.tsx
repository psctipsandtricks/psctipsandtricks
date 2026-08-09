import Link from 'next/link';
import { Button, Card, CardTitle, CardDescription, Badge } from '@psc/ui';
import { Sparkles, Trophy, BookOpen, Swords, Zap, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-16 py-4">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl glass-panel p-8 sm:p-14 text-center sm:text-left flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 ambient-glow-amber rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 ambient-glow-indigo rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-6 max-w-2xl relative z-10">
          <Badge variant="gold" className="text-xs uppercase tracking-widest px-3.5 py-1 inline-flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Kerala PSC 2026 Special Batch</span>
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight text-slate-900 dark:text-white">
            Master Kerala PSC Exams with{' '}
            <span className="bg-gradient-to-r from-amber-500 via-amber-400 to-indigo-500 bg-clip-text text-transparent">
              Smart Tips & Live Mocks
            </span>
          </h1>
          <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed font-medium">
            Access 10,000+ topic-wise practice questions, real-time live mock rank lists, memory tricks, and premium e-books curated by top PSC rank holders.
          </p>
          <div className="flex flex-wrap gap-4 pt-2 justify-center sm:justify-start">
            <Link href="/quizzes">
              <Button size="lg" variant="gold" className="font-bold shadow-lg shadow-amber-500/20">
                Start Live Mock Test 🔥
              </Button>
            </Link>
            <Link href="/books">
              <Button size="lg" variant="outline" className="font-semibold">
                Explore Question Banks
              </Button>
            </Link>
          </div>
        </div>

        {/* Ongoing Live Mock Tile */}
        <div className="w-full max-w-sm glass-card p-6 border-slate-200/80 dark:border-slate-800/80 relative z-10 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5" />
              <span>Ongoing Battle</span>
            </span>
            <span className="animate-pulse bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/30">
              LIVE NOW
            </span>
          </div>
          <h3 className="font-black text-slate-900 dark:text-white text-xl">Kerala PSC LDC Mega Mock 2026</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">100 Marks • Negative Marking 0.33</p>
          <div className="mt-5 pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex justify-between items-center text-sm font-medium text-slate-700 dark:text-slate-300">
            <span>Active Test Takers:</span>
            <span className="font-mono font-black text-amber-500">1,429 Aspirants</span>
          </div>
          <Link href="/quizzes" className="block mt-5">
            <Button className="w-full font-bold" variant="primary">
              <span>Join Live Test Now</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card hoverEffect className="space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shadow-md shadow-amber-500/10">
            <Trophy className="w-6 h-6" />
          </div>
          <CardTitle>Real-Time Rank List</CardTitle>
          <CardDescription>
            Instant percentile and state-wide rank calculation driven by background worker queues.
          </CardDescription>
        </Card>

        <Card hoverEffect className="space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-500 flex items-center justify-center shadow-md shadow-indigo-500/10">
            <BookOpen className="w-6 h-6" />
          </div>
          <CardTitle>Curated PDF E-Books</CardTitle>
          <CardDescription>
            Topic-wise previous year question papers with detailed step-by-step explanations and short memory tricks.
          </CardDescription>
        </Card>

        <Card hoverEffect className="space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/10">
            <Swords className="w-6 h-6" />
          </div>
          <CardTitle>Live Quiz Battles</CardTitle>
          <CardDescription>
            Challenge fellow PSC aspirants in 1-v-1 real-time WebSocket speed quizzes to boost accuracy.
          </CardDescription>
        </Card>
      </section>
    </div>
  );
}
