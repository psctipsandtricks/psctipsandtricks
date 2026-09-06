'use client';

import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Smartphone } from 'lucide-react';
import { SocialLinks } from '@psc/shared-types';
import { ApiClient } from '@/lib/api-client';
import { Reveal } from './reveal';
import {
  TelegramIcon,
  InstagramIcon,
  YoutubeIcon,
  FacebookIcon,
  TwitterIcon,
  GooglePlayIcon,
  AppStoreIcon,
} from './social-icons';

interface PlatformConfig {
  key: keyof Pick<SocialLinks, 'telegramUrl' | 'instagramUrl' | 'youtubeUrl' | 'facebookUrl' | 'twitterUrl'>;
  label: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Brand-gradient icon tile — the one place these cards break from the site's cyan/amber palette, deliberately, so each card reads as its platform at a glance. */
  tileGradient: string;
  hoverShadow: string;
  hoverBorder: string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    key: 'telegramUrl',
    label: 'Telegram',
    description: 'Join our channel for instant updates, PDFs, and daily current affairs.',
    icon: TelegramIcon,
    tileGradient: 'bg-gradient-to-br from-sky-400 to-blue-600',
    hoverShadow: 'hover:shadow-[0_20px_45px_-15px_rgba(2,132,199,0.45)]',
    hoverBorder: 'hover:border-sky-500/50 dark:hover:border-sky-400/40',
  },
  {
    key: 'instagramUrl',
    label: 'Instagram',
    description: 'Follow along for exam tips, quick revisions, and behind-the-scenes.',
    icon: InstagramIcon,
    tileGradient: 'bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-400',
    hoverShadow: 'hover:shadow-[0_20px_45px_-15px_rgba(219,39,119,0.45)]',
    hoverBorder: 'hover:border-fuchsia-500/50 dark:hover:border-fuchsia-400/40',
  },
  {
    key: 'youtubeUrl',
    label: 'YouTube',
    description: 'Subscribe for full video lessons, mock test walkthroughs, and more.',
    icon: YoutubeIcon,
    tileGradient: 'bg-gradient-to-br from-red-500 to-rose-700',
    hoverShadow: 'hover:shadow-[0_20px_45px_-15px_rgba(225,29,72,0.45)]',
    hoverBorder: 'hover:border-rose-500/50 dark:hover:border-rose-400/40',
  },
  {
    key: 'facebookUrl',
    label: 'Facebook',
    description: 'Like our page for announcements, events, and community discussions.',
    icon: FacebookIcon,
    tileGradient: 'bg-gradient-to-br from-blue-500 to-blue-700',
    hoverShadow: 'hover:shadow-[0_20px_45px_-15px_rgba(29,78,216,0.45)]',
    hoverBorder: 'hover:border-blue-500/50 dark:hover:border-blue-400/40',
  },
  {
    key: 'twitterUrl',
    label: 'Twitter',
    description: 'Follow us for quick updates, exam alerts, and important announcements.',
    icon: TwitterIcon,
    tileGradient: 'bg-gradient-to-br from-cyan-400 to-sky-600',
    hoverShadow: 'hover:shadow-[0_20px_45px_-15px_rgba(2,132,199,0.45)]',
    hoverBorder: 'hover:border-sky-500/50 dark:hover:border-sky-400/40',
  },
];

function SocialCardSkeleton() {
  return (
    <div className="w-full sm:w-72 rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] p-6 space-y-4 animate-pulse shadow-lg">
      <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-800" />
      <div className="h-5 w-24 rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="space-y-1.5">
        <div className="h-3.5 w-full rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-3.5 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}

/**
 * Owns the whole home-page social section, heading included, so it can
 * disappear as one piece: a "Follow Us" headline standing over empty space
 * would read as broken, not as "nothing configured yet". The heading is
 * still composed on the server and handed down, so it uses the same
 * `SectionHeading` as every other home section.
 */
export function HomeSocialLinks({ heading }: { heading?: React.ReactNode }) {
  const [links, setLinks] = useState<SocialLinks | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await ApiClient.getSocialLinks();
        if (isMounted) setLinks(data);
      } catch (err) {
        console.error('Failed to fetch social links:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const active = links ? PLATFORMS.filter((p) => Boolean(links[p.key])) : [];
  const hasAppLinks = Boolean(links?.playStoreUrl || links?.appStoreUrl);

  // Nothing configured — drop the section entirely rather than showing an
  // empty shell, so the home page never advertises a feature admin hasn't set up.
  if (!loading && active.length === 0 && !hasAppLinks) return null;

  return (
    <Reveal as="section" id="social-links" className="space-y-10 sm:space-y-12">
      {heading}

      {/* ── Social Media Channels ──────────────────────────────────── */}
      {active.length > 0 && (
        <div className="flex flex-wrap items-stretch justify-center gap-5 sm:gap-6 max-w-5xl mx-auto">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SocialCardSkeleton key={i} />)
            : active.map(({ key, label, description, icon: Icon, tileGradient, hoverShadow, hoverBorder }) => (
                <a
                  key={key}
                  href={links![key]!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group relative w-full sm:w-72 flex flex-col gap-4 rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] p-6 sm:p-7 shadow-lg transition-all duration-300 hover:-translate-y-1.5 ${hoverShadow} ${hoverBorder} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40`}
                >
                  <ArrowUpRight className="absolute top-6 right-6 w-4 h-4 text-slate-300 dark:text-slate-700 transition-all duration-300 group-hover:text-slate-500 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />

                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md transition-transform duration-300 group-hover:scale-110 ${tileGradient}`}
                  >
                    <Icon className="w-7 h-7" />
                  </div>

                  <div className="space-y-1 pr-4">
                    <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">{label}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
                  </div>
                </a>
              ))}
        </div>
      )}

      {/* ── Official Mobile App Download Banner ─────────────────────── */}
      {hasAppLinks && (
        <div className="relative overflow-hidden rounded-3xl sm:rounded-4xl border border-cyan-500/20 bg-gradient-to-br from-[#0c1a3a] via-[#091124] to-[#061224] p-6 sm:p-10 lg:p-12 shadow-2xl max-w-5xl mx-auto">
          {/* Ambient Glows */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Accent Gradient */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-500 to-amber-400" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-10 text-center lg:text-left">
            {/* App Info */}
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>Study Anywhere, Anytime</span>
              </div>
              <h3 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                Download the Official PSC Tips &amp; Tricks App
              </h3>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                Take your Kerala PSC preparation on the go with audio narrations, offline book reader, and instant live mock tests.
              </p>
            </div>

            {/* Store Download Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-3.5 shrink-0">
              {links?.playStoreUrl && (
                <a
                  href={links.playStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/50 shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-0.5 active:scale-95 transition-all duration-300"
                >
                  <GooglePlayIcon className="w-6 h-6 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <div className="text-[9px] uppercase font-bold tracking-widest text-slate-400 leading-none">
                      GET IT ON
                    </div>
                    <div className="text-sm font-extrabold text-white leading-tight mt-0.5 tracking-wide">
                      Google Play
                    </div>
                  </div>
                </a>
              )}

              {links?.appStoreUrl && (
                <a
                  href={links.appStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 shadow-lg hover:shadow-cyan-500/20 hover:-translate-y-0.5 active:scale-95 transition-all duration-300"
                >
                  <AppStoreIcon className="w-6 h-6 text-white shrink-0 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <div className="text-[9px] uppercase font-bold tracking-widest text-slate-400 leading-none">
                      Download on the
                    </div>
                    <div className="text-sm font-extrabold text-white leading-tight mt-0.5 tracking-wide">
                      App Store
                    </div>
                  </div>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </Reveal>
  );
}
