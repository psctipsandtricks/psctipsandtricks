import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@psc/ui';

export const metadata: Metadata = {
  title: 'PSC Admin Control Panel — PSC Tips & Tricks',
  description: 'Administrative dashboard for managing books, quizzes, user accounts, orders, push notifications, and analytics.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarItems = [
    { id: 'dashboard', label: 'Analytics Dashboard', href: '/' },
    { id: 'quizzes', label: 'Manage Quizzes', href: '/quizzes' },
    { id: 'books', label: 'Manage E-Books', href: '/books' },
    { id: 'users', label: 'User Management', href: '/users' },
    { id: 'orders', label: 'Orders & Payments', href: '/orders' },
    { id: 'coupons', label: 'Coupon Codes', href: '/coupons' },
    { id: 'notifications', label: 'Push Notifications', href: '/notifications' },
    { id: 'announcements', label: 'Announcements', href: '/announcements' },
  ];

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex bg-slate-950 text-slate-100">
        <Sidebar brandName="PSC Control Panel" items={sidebarItems} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-8 flex items-center justify-between">
            <span className="text-xs font-mono text-amber-400">Environment: Development</span>
            <div className="flex items-center space-x-3 text-sm">
              <span className="font-semibold text-slate-200">Admin Master</span>
              <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center">
                A
              </div>
            </div>
          </header>
          <main className="flex-1 p-8 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
