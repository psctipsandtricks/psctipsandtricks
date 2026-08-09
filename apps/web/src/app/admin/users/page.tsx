'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Button, Input, Pagination, Skeleton } from '@psc/ui';
import { Search, UserCheck, ShieldAlert, Zap, RefreshCw, Trash2, Mail, Users } from 'lucide-react';
import { ApiClient } from '@/lib/api-client';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';

interface StudentUser {
  id: string;
  name: string;
  email: string;
  loginMethod: 'Email' | 'Google' | 'Apple';
  registeredAt: string;
  status: 'Active' | 'Suspended';
  subscription: 'Free Tier' | 'VIP Unlimited';
}

export default function AdminUsersPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubscription, setFilterSubscription] = useState<string>('ALL');
  const [filterMethod, setFilterMethod] = useState<string>('ALL');

  useEffect(() => {
    setMounted(true);
    loadStudents();
  }, []);

  const INITIAL_STUDENTS: StudentUser[] = [
    { id: 'usr-101', name: 'Anandu Krishnan', email: 'anandu.k@gmail.com', loginMethod: 'Google', registeredAt: '2026-07-28', status: 'Active', subscription: 'VIP Unlimited' },
    { id: 'usr-102', name: 'Sneha Nair', email: 'sneha.nair@psctips.com', loginMethod: 'Email', registeredAt: '2026-07-30', status: 'Active', subscription: 'VIP Unlimited' },
    { id: 'usr-103', name: 'Rahul Varma', email: 'rahul.varma@icloud.com', loginMethod: 'Apple', registeredAt: '2026-08-01', status: 'Active', subscription: 'Free Tier' },
    { id: 'usr-104', name: 'Divya S. Pillai', email: 'divya.sp@gmail.com', loginMethod: 'Google', registeredAt: '2026-08-02', status: 'Active', subscription: 'Free Tier' },
    { id: 'usr-105', name: 'Muhammed Shafi', email: 'shafi.m@gmail.com', loginMethod: 'Email', registeredAt: '2026-08-03', status: 'Active', subscription: 'VIP Unlimited' },
  ];

  const determineLoginMethod = (email: string, oauthIdentities?: Array<{ provider: string }>): 'Email' | 'Google' | 'Apple' => {
    if (Array.isArray(oauthIdentities) && oauthIdentities.length > 0) {
      const prov = oauthIdentities[0].provider?.toUpperCase();
      if (prov === 'GOOGLE') return 'Google';
      if (prov === 'APPLE') return 'Apple';
    }
    if (email) {
      const lower = email.toLowerCase();
      if (lower.endsWith('@gmail.com') || lower.endsWith('@googlemail.com')) {
        return 'Google';
      }
      if (lower.endsWith('@icloud.com') || lower.endsWith('@apple.com')) {
        return 'Apple';
      }
    }
    return 'Email';
  };

  const loadStudents = async () => {
    let apiStudents: StudentUser[] = [];
    try {
      const dbUsers = await ApiClient.getUsers();
      if (Array.isArray(dbUsers) && dbUsers.length > 0) {
        apiStudents = dbUsers.map((u: any) => ({
          id: u.id,
          name: u.name || u.email.split('@')[0],
          email: u.email,
          loginMethod: determineLoginMethod(u.email, u.oauthIdentities),
          registeredAt: u.createdAt ? new Date(u.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          status: u.status === 'SUSPENDED' ? 'Suspended' as const : 'Active' as const,
          subscription: u.isPremium ? 'VIP Unlimited' as const : 'Free Tier' as const,
        }));
      }
    } catch (err) {
      console.warn('Could not fetch users from backend API:', err);
    }

    let localSessionUser: StudentUser | null = null;
    try {
      const pscUserRaw = localStorage.getItem('psc_user');
      if (pscUserRaw) {
        const pscUser = JSON.parse(pscUserRaw);
        if (pscUser && pscUser.email) {
          localSessionUser = {
            id: pscUser.id || 'usr-local-session',
            name: pscUser.name || pscUser.email.split('@')[0],
            email: pscUser.email,
            loginMethod: determineLoginMethod(pscUser.email, pscUser.oauthIdentities),
            registeredAt: new Date().toISOString().split('T')[0],
            status: 'Active' as const,
            subscription: pscUser.isPremium ? 'VIP Unlimited' as const : 'Free Tier' as const,
          };
        }
      }
    } catch (e) {}

    let storedLocal: StudentUser[] = [];
    try {
      const stored = localStorage.getItem('psc_registered_students');
      if (stored) {
        storedLocal = JSON.parse(stored);
      }
    } catch (e) {}

    const baseList = apiStudents.length > 0 ? apiStudents : (storedLocal.length > 0 ? storedLocal : INITIAL_STUDENTS);

    const finalMap = new Map<string, StudentUser>();
    
    if (localSessionUser) {
      finalMap.set(localSessionUser.email.toLowerCase(), localSessionUser);
    }

    baseList.forEach((s) => {
      if (!finalMap.has(s.email.toLowerCase())) {
        finalMap.set(s.email.toLowerCase(), {
          ...s,
          loginMethod: determineLoginMethod(s.email, (s as any).oauthIdentities),
        });
      }
    });

    const mergedList = Array.from(finalMap.values());
    setStudents(mergedList);
    try {
      localStorage.setItem('psc_registered_students', JSON.stringify(mergedList));
    } catch (e) {}
    setLoading(false);
  };

  const handleToggleStatus = (id: string) => {
    const updated = students.map((s) => {
      if (s.id === id) {
        return {
          ...s,
          status: s.status === 'Active' ? ('Suspended' as const) : ('Active' as const),
        };
      }
      return s;
    });
    setStudents(updated);
    localStorage.setItem('psc_registered_students', JSON.stringify(updated));
  };

  const handleTogglePlan = (id: string) => {
    const updated = students.map((s) => {
      if (s.id === id) {
        return {
          ...s,
          subscription: s.subscription === 'VIP Unlimited' ? ('Free Tier' as const) : ('VIP Unlimited' as const),
        };
      }
      return s;
    });
    setStudents(updated);
    localStorage.setItem('psc_registered_students', JSON.stringify(updated));
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this student account?')) {
      const updated = students.filter((s) => s.id !== id);
      setStudents(updated);
      localStorage.setItem('psc_registered_students', JSON.stringify(updated));
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterMethod]);

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMethod = filterMethod === 'ALL' || s.loginMethod.toUpperCase() === filterMethod.toUpperCase();
    return matchesSearch && matchesMethod;
  });

  const totalItems = filteredStudents.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (!mounted) {
    return (
      <div className="space-y-8">
        <AdminSkeletonHeader />
        <AdminSkeletonTable rowsCount={5} colsCount={6} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-8 px-1 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Student Account Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
            View and manage registered student accounts, login providers, subscription statuses, and account controls.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-3 w-full md:w-auto">
          <div className="w-full md:w-64">
            <Input
              placeholder="Search name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="ALL">All Providers</option>
            <option value="GOOGLE">Google</option>
            <option value="APPLE">Apple</option>
            <option value="EMAIL">Email</option>
          </select>
        </div>
      </div>

      <Card className="p-3 sm:p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student Details</TableHead>
              <TableHead>Login Method</TableHead>
              <TableHead>Registration Date</TableHead>
              <TableHead>Subscription Plan</TableHead>
              <TableHead>Account Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`} className="border-b border-slate-200/80 dark:border-slate-800/60">
                  <TableCell className="py-4"><Skeleton className="h-5 w-44 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-28 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
                  <TableCell className="py-4 text-right"><Skeleton className="h-8 w-24 rounded-xl ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : paginatedStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Student Match</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        No registered student accounts found matching your search or filter criteria.
                      </p>
                    </div>
                    {(searchTerm || filterMethod !== 'ALL') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs font-bold border-cyan-500/40 text-cyan-600 hover:bg-cyan-500/10 mt-1 cursor-pointer"
                        onClick={() => {
                          setSearchTerm('');
                          setFilterMethod('ALL');
                        }}
                      >
                        Reset All Filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{student.name}</span>
                      <span className="text-xs font-mono text-slate-400">{student.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        student.loginMethod === 'Google'
                          ? 'warning'
                          : student.loginMethod === 'Apple'
                          ? 'default'
                          : 'outline'
                      }
                      className="font-bold uppercase tracking-wider"
                    >
                      {student.loginMethod === 'Google'
                        ? '🌐 Google'
                        : student.loginMethod === 'Apple'
                        ? '🍏 Apple'
                        : '✉️ Email'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">{student.registeredAt}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleTogglePlan(student.id)}
                      className="cursor-pointer"
                      title="Click to toggle subscription plan"
                    >
                      <Badge
                        variant={student.subscription === 'VIP Unlimited' ? 'gold' : 'outline'}
                        className="font-semibold"
                      >
                        {student.subscription === 'VIP Unlimited' ? '⭐ VIP Unlimited' : 'Free Tier'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={student.status === 'Active' ? 'success' : 'danger'}>
                      {student.status === 'Active' ? 'Active' : 'Suspended'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        size="sm"
                        variant={student.status === 'Active' ? 'outline' : 'primary'}
                        onClick={() => handleToggleStatus(student.id)}
                        className="text-xs"
                      >
                        {student.status === 'Active' ? 'Suspend' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(student.id)}
                        className="p-2"
                        title="Delete Student Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="px-4 pb-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      </Card>
    </div>
  );
}
