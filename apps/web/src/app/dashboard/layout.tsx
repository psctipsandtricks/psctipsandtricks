import { privatePageMetadata } from '@/lib/seo';

export const metadata = privatePageMetadata('My Dashboard');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
