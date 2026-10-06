import { privatePageMetadata } from '@/lib/seo';

export const metadata = privatePageMetadata('My Orders');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
