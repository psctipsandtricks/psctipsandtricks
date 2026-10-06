import { privatePageMetadata } from '@/lib/seo';

export const metadata = privatePageMetadata('My Profile');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
