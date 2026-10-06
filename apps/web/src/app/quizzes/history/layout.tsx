import { privatePageMetadata } from '@/lib/seo';

export const metadata = privatePageMetadata('Quiz History');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
