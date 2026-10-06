import { privatePageMetadata } from '@/lib/seo';

export const metadata = privatePageMetadata('Reader');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
