'use client';

import React, { useState } from 'react';
import { Card, CardTitle, Input, Button, Badge } from '@psc/ui';

export default function AdminAnnouncementsPage() {
  const [bannerText, setBannerText] = useState('⚡ Admission open for Kerala PSC LDC Batch 2026! Use code PSC2026 for 20% OFF');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Announcement Banner Config</h1>
        <p className="text-slate-400 text-sm mt-1">Configure global announcement banners shown at the top of web and mobile apps.</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Global Banner Message</CardTitle>
          <Badge variant="gold">Active</Badge>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Banner Announcement Message"
            value={bannerText}
            onChange={(e) => setBannerText(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" className="w-full">
            Update Banner
          </Button>
          {isSaved && <p className="text-xs text-emerald-400 font-semibold text-center">✓ Announcement banner updated!</p>}
        </form>
      </Card>
    </div>
  );
}
