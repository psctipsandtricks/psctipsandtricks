'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Input } from '@psc/ui';

const SAMPLE_BOOKS = [
  {
    id: 'book-1',
    title: 'Kerala PSC Master Question Bank 2026',
    author: 'PSC Tips Expert Team',
    description: '10,000+ Previous Year Questions with detailed explanations and shortcuts.',
    price: 299,
    category: 'Question Bank',
    coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
    downloadCount: 1420,
  },
  {
    id: 'book-2',
    title: 'Indian Constitution & Polity Guide',
    author: 'Dr. K. R. Nambiar',
    description: 'Articles, Amendments, Landmark judgements and memory memory tricks.',
    price: 199,
    category: 'Polity',
    coverUrl: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=600&q=80',
    downloadCount: 850,
  },
  {
    id: 'book-3',
    title: 'Kerala History & Cultural Heritage',
    author: 'Prof. S. R. Pillai',
    description: 'Comprehensive guide covering Travancore, Cochin, and Malabar history for Tenth/Degree Level.',
    price: 249,
    category: 'Kerala GK',
    coverUrl: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80',
    downloadCount: 620,
  },
];

export default function BooksPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBooks = SAMPLE_BOOKS.filter((b) =>
    b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">PSC Study Materials & E-Books</h1>
          <p className="text-slate-400 text-sm mt-1">Download official PSC handbooks, solved papers, and topic-wise guides.</p>
        </div>
        <div className="w-full md:w-72">
          <Input
            placeholder="Search books by title or topic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredBooks.map((book) => (
          <Card key={book.id} hoverEffect className="flex flex-col justify-between">
            <CardHeader className="space-y-3">
              <div className="flex justify-between items-start">
                <Badge variant="gold">{book.category}</Badge>
                <span className="text-xs text-slate-400">📥 {book.downloadCount} downloads</span>
              </div>
              <CardTitle className="text-lg leading-snug">{book.title}</CardTitle>
              <p className="text-xs text-amber-400 font-medium">By {book.author}</p>
              <CardDescription>{book.description}</CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-between items-center pt-4">
              <div>
                <span className="text-xs text-slate-400 block">Price</span>
                <span className="text-xl font-extrabold text-white">₹{book.price}</span>
              </div>
              <Link href={`/books/${book.id}`}>
                <Button variant="primary" size="sm">
                  View Book
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
