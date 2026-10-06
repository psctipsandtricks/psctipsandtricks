import { privatePageMetadata } from '@/lib/seo';

export const metadata = privatePageMetadata('Signing In');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
