import { privatePageMetadata } from '@/lib/seo';

export const metadata = privatePageMetadata('Mock Test');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
