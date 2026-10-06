import { privatePageMetadata } from '@/lib/seo';

export const metadata = privatePageMetadata('Notifications');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
