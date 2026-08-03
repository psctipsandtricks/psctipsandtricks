import Link from 'next/link';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@psc/ui';

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-8 sm:p-12 text-center sm:text-left flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
        <div className="space-y-4 max-w-2xl">
          <Badge variant="gold" className="text-xs uppercase tracking-widest px-3 py-1">
            ⚡ Kerala PSC 2026 Special Batch
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Master Kerala PSC Exams with <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">Smart Tips & Live Mocks</span>
          </h1>
          <p className="text-slate-300 text-lg">
            Access 10,000+ topic-wise practice questions, real-time live mock rank lists, memory tricks, and premium e-books curated by top PSC rank holders.
          </p>
          <div className="flex flex-wrap gap-4 pt-2 justify-center sm:justify-start">
            <Link href="/quizzes">
              <Button size="lg" variant="gold" className="font-bold">
                Start Live Mock Test 🔥
              </Button>
            </Link>
            <Link href="/books">
              <Button size="lg" variant="outline">
                Explore Question Banks
              </Button>
            </Link>
          </div>
        </div>
        <div className="w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">⚡ Ongoing Battle</span>
            <span className="animate-pulse bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full font-mono">LIVE</span>
          </div>
          <h3 className="font-bold text-white text-lg">Kerala PSC LDC Mega Mock 2026</h3>
          <p className="text-xs text-slate-400 mt-1">100 Marks • Negative Marking 0.33</p>
          <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-sm text-slate-300">
            <span>Active Test Takers:</span>
            <span className="font-mono font-bold text-amber-400">1,429 Aspirants</span>
          </div>
          <Link href="/quizzes/demo-quiz" className="block mt-4">
            <Button className="w-full" variant="primary">
              Join Live Test Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card hoverEffect className="space-y-2">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-2xl font-bold">
            🏆
          </div>
          <CardTitle>Real-Time Rank List</CardTitle>
          <CardDescription>
            Instant percentile and state-wide rank calculation driven by Redis and background worker queues.
          </CardDescription>
        </Card>

        <Card hoverEffect className="space-y-2">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-2xl font-bold">
            📚
          </div>
          <CardTitle>Curated PDF E-Books</CardTitle>
          <CardDescription>
            Topic-wise previous year question papers with detailed step-by-step explanations and short memory tricks.
          </CardDescription>
        </Card>

        <Card hoverEffect className="space-y-2">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-2xl font-bold">
            ⚔️
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
