'use client';

import React, { useState } from 'react';
import { Card, Input, Button } from '@psc/ui';

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSendPush = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      alert('🚀 FCM Push Notification queued in BullMQ successfully!');
      setTitle('');
      setBody('');
    }, 1200);
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Push Notification Composer</h1>
        <p className="text-slate-400 text-sm mt-1">Broadcast Firebase FCM push notifications to student mobile & web apps.</p>
      </div>

      <Card className="p-6 space-y-4">
        <form onSubmit={handleSendPush} className="space-y-4">
          <Input
            label="Notification Title"
            placeholder="🔥 New Live Mock Test is Live!"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-300">Message Body</label>
            <textarea
              className="w-full h-32 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Join 1,000+ aspirants taking the Kerala PSC LDC Mock Test right now..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>
          <Button type="submit" variant="gold" size="lg" className="w-full font-bold" isLoading={isSending}>
            Dispatch Push Notification 🚀
          </Button>
        </form>
      </Card>
    </div>
  );
}
