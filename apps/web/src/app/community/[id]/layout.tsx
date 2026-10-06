import { privatePageMetadata } from '@/lib/seo';

export const metadata = privatePageMetadata('Study Group');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
