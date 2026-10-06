import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Kerala PSC Aspirant Community',
  description:
    'Join study groups with thousands of Kerala PSC aspirants. Discuss questions, share notes and get guidance from mentors.',
  path: '/community',
  keywords: ['Kerala PSC study group', 'PSC aspirants community'],
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
