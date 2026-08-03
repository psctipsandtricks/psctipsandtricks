'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar, Card, Input, Button } from '@psc/ui';
import { ShieldCheck, LogOut } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const authStatus = localStorage.getItem('admin_authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      if (email.trim() === 'psctipsandtricksapp@gmail.com' && password === 'admin') {
        localStorage.setItem('admin_authenticated', 'true');
        localStorage.setItem('admin_email', email.trim());
        setIsAuthenticated(true);
      } else {
        setError('Invalid admin credentials. Please check your email and password.');
      }
      setIsLoading(false);
    }, 500);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_authenticated');
    localStorage.removeItem('admin_email');
    setIsAuthenticated(false);
    setEmail('');
    setPassword('');
  };

  const sidebarItems = [
    { id: 'dashboard', label: 'Analytics Dashboard', href: '/admin' },
    { id: 'quizzes', label: 'Manage Quizzes', href: '/admin/quizzes' },
    { id: 'books', label: 'Manage E-Books', href: '/admin/books' },
    { id: 'users', label: 'User Management', href: '/admin/users' },
    { id: 'orders', label: 'Orders & Payments', href: '/admin/orders' },
    { id: 'coupons', label: 'Coupon Codes', href: '/admin/coupons' },
    { id: 'notifications', label: 'Push Notifications', href: '/admin/notifications' },
    { id: 'announcements', label: 'Announcements', href: '/admin/announcements' },
  ];

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-100">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">PSC Admin Control Panel</h1>
            <p className="text-sm text-slate-400">Restricted Access. Please enter admin credentials to proceed.</p>
          </div>

          <Card className="p-6 space-y-4 border-slate-800 bg-slate-900/90 shadow-2xl">
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="p-3 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 font-medium text-center">
                  {error}
                </div>
              )}

              <Input
                label="Admin Email"
                type="email"
                placeholder="psctipsandtricksapp@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                label="Admin Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Button
                type="submit"
                variant="gold"
                size="lg"
                className="w-full font-bold flex items-center justify-center space-x-2"
                isLoading={isLoading}
              >
                <span>Authenticate & Access Panel</span>
              </Button>
            </form>
          </Card>

          <p className="text-center text-xs text-slate-500">
            PSC Tips & Tricks &copy; 2026 Admin Authorization System
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      <Sidebar brandName="PSC Control Panel" items={sidebarItems} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-8 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full">
              Authenticated Admin
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 text-sm">
              <span className="font-medium text-slate-300 text-xs font-mono">
                psctipsandtricksapp@gmail.com
              </span>
              <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-sm shadow-md">
                A
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors bg-slate-800/80 hover:bg-rose-500/10 border border-slate-700 hover:border-rose-500/30 px-3 py-1.5 rounded-lg"
              title="Logout from Admin Panel"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </header>
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
