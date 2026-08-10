'use client';

import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, Dialog, ConfirmDialog, Input, Badge, Pagination, Skeleton } from '@psc/ui';
import { AdminSkeletonHeader, AdminSkeletonTable } from '../admin-skeleton';
import { Edit3, Trash2, BookOpen } from 'lucide-react';

const bookSchema = Yup.object({
  title: Yup.string().trim().required('Book title is required'),
  author: Yup.string().trim().required('Author name is required'),
  category: Yup.string().trim().required('Category is required'),
  price: Yup.number().typeError('Price must be a number').positive('Price must be greater than 0').required('Price is required'),
});

interface BookItem {
  id: string;
  title: string;
  author: string;
  category: string;
  price: number;
  downloadCount: number;
}

export default function AdminBooksPage() {
  const [mounted, setMounted] = React.useState(false);
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<BookItem[]>([
    { id: 'b-1', title: 'Kerala PSC Master Question Bank 2026', author: 'PSC Tips Expert Team', category: 'Question Bank', price: 299, downloadCount: 1420 },
    { id: 'b-2', title: 'Indian Constitution & Polity Guide', author: 'Dr. K. R. Nambiar', category: 'Polity', price: 199, downloadCount: 850 },
    { id: 'b-3', title: 'Kerala Geography & Rivers Handbook', author: 'Prof. V. S. Pillai', category: 'Geography', price: 149, downloadCount: 620 },
  ]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookItem | null>(null);

  React.useEffect(() => {
    setMounted(true);
    setLoading(false);
  }, []);

  const formik = useFormik({
    initialValues: { title: '', author: '', category: '', price: '299' },
    validationSchema: bookSchema,
    onSubmit: (values, { resetForm }) => {
      const newBook: BookItem = {
        id: `b-${Date.now()}`,
        title: values.title.trim(),
        author: values.author.trim(),
        category: values.category.trim(),
        price: Number(values.price),
        downloadCount: 0,
      };
      setBooks((prev) => [newBook, ...prev]);
      resetForm();
      setIsDialogOpen(false);
    },
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <AdminSkeletonHeader />
        <AdminSkeletonTable rowsCount={4} colsCount={7} />
      </div>
    );
  }

  const handleDeleteBook = (id: string) => {
    setBooks(books.filter((b) => b.id !== id));
  };

  const totalItems = books.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedBooks = books.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4 sm:space-y-6 px-1 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">E-Book Content Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">Upload and manage PSC PDF handbooks and question banks.</p>
        </div>
        <Button variant="gold" className="font-bold shadow-md shadow-amber-500/20 w-full sm:w-auto shrink-0" onClick={() => setIsDialogOpen(true)}>
          + Add New Book
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"><span className="sr-only">Cover</span></TableHead>
              <TableHead>Book Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Downloads</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`} className="border-b border-slate-200/80 dark:border-slate-800/60">
                  <TableCell className="py-4 w-12"><Skeleton className="h-9 w-9 rounded-xl" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-48 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-32 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-lg" /></TableCell>
                  <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
                  <TableCell className="py-4 text-right"><Skeleton className="h-8 w-20 rounded-xl ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : books.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No E-Book Match</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        No e-books available. Upload your first PDF book for students to purchase.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedBooks.map((book) => (
                <TableRow key={book.id}>
                  <TableCell className="w-12">
                    <div className="w-9 h-9 bg-slate-100 dark:bg-[#091124] rounded-xl flex items-center justify-center text-cyan-400 border border-slate-200 dark:border-[#1e2e56]">
                      <BookOpen className="w-4 h-4" />
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 dark:text-white">{book.title}</TableCell>
                  <TableCell className="text-slate-700 dark:text-slate-300 font-medium">{book.author}</TableCell>
                  <TableCell><Badge variant="gold">{book.category}</Badge></TableCell>
                  <TableCell className="font-mono text-cyan-400 font-extrabold">₹{book.price}</TableCell>
                  <TableCell className="font-mono text-slate-700 dark:text-slate-300">{book.downloadCount.toLocaleString()}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="p-2 rounded-xl text-cyan-700 dark:text-cyan-300 hover:text-cyan-400 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all shadow-xs"
                        title="Edit Book"
                        onClick={() => alert(`Editing book "${book.title}"`)}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="p-2 rounded-xl transition-all shadow-xs"
                        title="Delete Book"
                        onClick={() => setDeleteTarget(book)}
                      >
                        <Trash2 className="w-4 h-4" />
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

      <Dialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title="Upload New E-Book">
        <form className="space-y-4 pt-2" onSubmit={formik.handleSubmit} noValidate>
          <Input
            label="Book Title"
            name="title"
            placeholder="e.g. Kerala Geography Handbook 2026"
            value={formik.values.title}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.title && formik.errors.title ? formik.errors.title : undefined}
          />
          <Input
            label="Author Name"
            name="author"
            placeholder="e.g. Dr. S. K. Nair"
            value={formik.values.author}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.author && formik.errors.author ? formik.errors.author : undefined}
          />
          <Input
            label="Category"
            name="category"
            placeholder="e.g. Question Bank / Polity / Geography"
            value={formik.values.category}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.category && formik.errors.category ? formik.errors.category : undefined}
          />
          <Input
            label="Price (INR)"
            name="price"
            type="number"
            placeholder="299"
            value={formik.values.price}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.price && formik.errors.price ? formik.errors.price : undefined}
          />
          <Button type="submit" variant="gold" className="w-full font-bold shadow-md shadow-cyan-500/20">
            Publish Book
          </Button>
        </form>
      </Dialog>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Book"
        description={deleteTarget ? `This will permanently remove "${deleteTarget.title}" by ${deleteTarget.author}. This action cannot be undone.` : undefined}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) handleDeleteBook(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
