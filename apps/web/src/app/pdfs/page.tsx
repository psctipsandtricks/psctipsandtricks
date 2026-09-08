'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiClient } from '@/lib/api-client';
import { Card, Input, Button, Badge } from '@psc/ui';
import {
  FileText,
  Folder,
  FolderOpen,
  Search,
  ArrowLeft,
  ChevronRight,
  X,
  ExternalLink,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import type { PdfFolder, PdfDocument } from '@psc/shared-types';
import { useAuth } from '../auth-provider';

const SecurePdfViewer = dynamic(
  () => import('@/components/secure-pdf-viewer').then((mod) => mod.SecurePdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 min-h-[300px] flex flex-col items-center justify-center p-12 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500 mb-3" />
        <p className="text-xs font-bold font-mono">Loading Document Reader…</p>
      </div>
    ),
  }
);

function PdfFolderSkeleton() {
  return (
    <div className="p-5 rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] space-y-3 shadow-xs animate-pulse">
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="space-y-1.5">
        <div className="h-4 w-3/4 rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800/60" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
        <div className="h-3 w-20 rounded bg-slate-100 dark:bg-slate-800/60" />
        <div className="h-3 w-16 rounded bg-slate-100 dark:bg-slate-800/60" />
      </div>
    </div>
  );
}

function PdfDocumentSkeleton() {
  return (
    <div className="p-4 rounded-3xl border border-slate-200/80 dark:border-[#1e2e56] bg-white dark:bg-[#091124] space-y-3 shadow-xs animate-pulse flex flex-col justify-between">
      <div className="space-y-2.5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3.5 w-4/5 rounded-lg bg-slate-200 dark:bg-slate-800" />
            <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-800/60" />
          </div>
        </div>
        <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800/60" />
      </div>
      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}

function PdfsContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFolderId = searchParams.get('folderId') || '';

  const [loading, setLoading] = useState(true);
  const [currentFolderData, setCurrentFolderData] = useState<{
    folder?: PdfFolder;
    breadcrumbs: { id: string; name: string }[];
    subFolders: PdfFolder[];
    documents: PdfDocument[];
  }>({ breadcrumbs: [], subFolders: [], documents: [] });

  const [topLevelFolders, setTopLevelFolders] = useState<PdfFolder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PdfDocument[] | null>(null);
  const [searching, setSearching] = useState(false);

  // PDF Viewer Modal
  const [selectedDoc, setSelectedDoc] = useState<PdfDocument | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [user, authLoading, router]);

  // Load Folder Content
  const loadContent = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      if (currentFolderId) {
        const folderRes = await ApiClient.getPdfFolder(currentFolderId);
        setCurrentFolderData({
          folder: folderRes,
          breadcrumbs: folderRes.breadcrumbs || [],
          subFolders: folderRes.children || [],
          documents: folderRes.documents || [],
        });
      } else {
        const [rootFolders, rootDocs] = await Promise.all([
          ApiClient.getPdfFolders('root'),
          ApiClient.getPdfDocuments({ folderId: '' }),
        ]);
        setTopLevelFolders(rootFolders || []);
        setCurrentFolderData({
          breadcrumbs: [],
          subFolders: rootFolders || [],
          documents: rootDocs || [],
        });
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, user]);

  useEffect(() => {
    if (user) {
      loadContent();
    }
  }, [loadContent, user]);

  // Handle Search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const results = await ApiClient.getPdfDocuments({ search: searchTerm.trim() });
        setSearchResults(results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSelectFolder = (id: string) => {
    setSearchTerm('');
    setSearchResults(null);
    router.push(id ? `/pdfs?folderId=${encodeURIComponent(id)}` : '/pdfs');
  };

  // Only show folders that have at least 1 document inside them (directly or recursively)
  const visibleSubFolders = currentFolderData.subFolders.filter(
    (folder) => (folder.documentCount || 0) > 0
  );

  return (
    <div className="space-y-6 py-2 sm:py-4 w-full max-w-7xl mx-auto px-2 sm:px-0">
      {/* Header Banner */}
      <div className="rounded-3xl glass-panel p-6 sm:p-8 space-y-4">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Digital Study Materials</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              PDF Study Material Library
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Browse previous question papers, subject-wise summary notes, and topic-wise revision PDFs.
            </p>
          </div>

          <div className="relative w-full md:w-80 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <Input
              placeholder="Search PDF documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 text-xs bg-slate-50 dark:bg-[#0c152e]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumb Bar */}
        {currentFolderId && (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex-wrap">
            <button
              type="button"
              onClick={() => handleSelectFolder('')}
              className="hover:text-amber-500 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All PDF Categories</span>
            </button>
            {currentFolderData.breadcrumbs.map((bc, idx) => (
              <React.Fragment key={bc.id}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                {idx === currentFolderData.breadcrumbs.length - 1 ? (
                  <span className="text-slate-900 dark:text-white font-black truncate max-w-xs">
                    {bc.name}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelectFolder(bc.id)}
                    className="hover:text-amber-500 truncate max-w-xs cursor-pointer"
                  >
                    {bc.name}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading || authLoading || !user ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="h-4 w-44 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <PdfFolderSkeleton key={i} />
              ))}
            </div>
          </div>
          {currentFolderId && (
            <div className="space-y-3 pt-2">
              <div className="h-4 w-40 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <PdfDocumentSkeleton key={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : searchResults !== null ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Search Results ({searchResults.length})
            </h2>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-xs font-bold text-amber-500 hover:underline cursor-pointer"
            >
              Clear Search
            </button>
          </div>

          {searching ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <PdfDocumentSkeleton key={i} />
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#091124]">
              <p className="text-xs font-bold text-slate-400">No PDF documents matched "{searchTerm}".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {searchResults.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-3xl glass-card hover-lift overflow-hidden p-4 space-y-3 flex flex-col justify-between"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-inner">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {doc.title}
                      </h3>
                      {doc.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{doc.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    {doc.fileUrl ? (
                      <button
                        type="button"
                        onClick={() => setSelectedDoc(doc)}
                        className="text-xs font-bold text-amber-500 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Read Online</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">Document unavailable</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Subfolders Grid */}
          {visibleSubFolders.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                {currentFolderId ? 'Sub-Folders' : 'Explore by Category'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {visibleSubFolders.map((folder) => (
                  <div
                    key={folder.id}
                    onClick={() => handleSelectFolder(folder.id)}
                    className="p-5 rounded-3xl glass-card hover-lift space-y-3 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform shadow-inner">
                        <Folder className="w-6 h-6" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                    </div>

                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors truncate">
                        {folder.name}
                      </h3>
                      {folder.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">{folder.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-mono text-slate-400">
                      <span>{folder.documentCount || 0} documents</span>
                      {folder.subFolderCount ? <span>{folder.subFolderCount} subfolders</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF Documents in Current Folder */}
          {currentFolderId && (
            <div className="space-y-3 pt-2">
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                PDF Documents ({currentFolderData.documents.length})
              </h2>

              {currentFolderData.documents.length === 0 ? (
                visibleSubFolders.length === 0 ? (
                  <div className="p-12 text-center rounded-3xl border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#091124]">
                    <p className="text-xs font-bold text-slate-400">
                      No study materials found in this category.
                    </p>
                  </div>
                ) : (
                  <div className="p-12 text-center rounded-3xl border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#091124]">
                    <p className="text-xs font-bold text-slate-400">
                      No documents directly inside this folder. Explore the subfolders above.
                    </p>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {currentFolderData.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 rounded-3xl glass-card hover-lift space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 shadow-inner">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {doc.title}
                            </h3>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {doc.fileName || 'Uploaded PDF'}
                            </p>
                          </div>
                        </div>

                        {doc.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {doc.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        {doc.fileUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedDoc(doc)}
                            className="text-xs font-bold text-amber-500 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Read Online</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Document unavailable</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Root empty state if no folders or documents available */}
          {!currentFolderId && visibleSubFolders.length === 0 && currentFolderData.documents.length === 0 && (
            <div className="p-12 text-center rounded-3xl border border-slate-200 dark:border-[#1e2e56] bg-white dark:bg-[#091124]">
              <p className="text-xs font-bold text-slate-400">
                No PDF study materials available at the moment.
              </p>
            </div>
          )}
        </>
      )}

      {/* PDF Document Reader Modal */}
      {selectedDoc?.fileUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-2 sm:p-6 !mt-0"
          role="dialog"
          aria-modal="true"
          aria-label={`PDF Viewer: ${selectedDoc.title}`}
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="w-full max-w-5xl h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-2xl overflow-hidden flex flex-col transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <SecurePdfViewer
              url={selectedDoc.fileUrl}
              title={selectedDoc.title}
              user={user ? { id: user.id, name: user.name, email: user.email, phone: user.phoneNumber || undefined } : null}
              onClose={() => setSelectedDoc(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentPdfsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 py-2 sm:py-4 w-full max-w-7xl mx-auto px-2 sm:px-0">
          <div className="space-y-3">
            <div className="h-4 w-44 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <PdfFolderSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <PdfsContent />
    </Suspense>
  );
}
