'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardTitle, CardDescription, Input, Button } from '@psc/ui';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      alert('Account Created Successfully!');
      window.location.href = '/dashboard';
    }, 1000);
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <Card className="p-8 space-y-6">
        <div className="text-center space-y-2">
          <CardTitle className="text-2xl">Create Student Account</CardTitle>
          <CardDescription>Join 50,000+ Kerala PSC aspirants studying smart.</CardDescription>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Rahul V. Nair"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="aspirant@psctips.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="gold" className="w-full font-bold" isLoading={isLoading}>
            Create Account ⚡
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400">
          Already registered?{' '}
          <Link href="/login" className="text-indigo-400 font-semibold hover:underline">
            Log In
          </Link>
        </p>
      </Card>
    </div>
  );
}
