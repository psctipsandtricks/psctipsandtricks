/**
 * One-time migration: imports books/chapters/topics exported from the old
 * database (phpMyAdmin JSON export) into this app's Supabase Postgres DB,
 * uploading the matching local cover/audio/PDF files to Supabase Storage
 * along the way. Run from apps/api:
 *
 *   node scripts/migrate-legacy-books.js [books.json] [chapters.json] [topics.json] [storageBaseDir]
 *
 * Source shape: phpMyAdmin's "Export to JSON" format — each file is
 * [header, database, { type: 'table', data: [...rows] }].
 *
 * Storage layout used (matches the bucket names books.service.ts already
 * uploads into, so files land exactly where the admin UI's own upload
 * buttons would put them):
 *   book-covers/<newBookId>/<filename>
 *   book-pdfs/<newBookId>/<filename>          (book-level merged PDF)
 *   chapter-audio/<newBookId>/<newChapterId>/<filename>
 *   chapter-pdfs/<newBookId>/<newChapterId>/<filename>
 *   topic-audio/<newTopicId>/<filename>
 *   topic-pdfs/<newTopicId>/<filename>
 *
 * Every book/chapter/topic gets a brand-new UUID (never reusing the legacy
 * numeric ids); old_id -> new_id maps and a full run summary (including any
 * file references that had no matching local file) are written to
 * scripts/migration-output/ afterwards.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const BOOKS_PATH = process.argv[2] || '/Users/antoanstin/Downloads/books.json';
const CHAPTERS_PATH = process.argv[3] || '/Users/antoanstin/Downloads/chapters.json';
const TOPICS_PATH = process.argv[4] || '/Users/antoanstin/Downloads/topics.json';
const STORAGE_BASE =
  process.argv[5] ||
  '/Users/antoanstin/Downloads/web 2/psctipsandtricks.com/public_html/storage/app/public';
const OUTPUT_DIR = path.join(__dirname, 'migration-output');
const UPLOAD_CONCURRENCY = 6;
const DB_CHUNK_SIZE = 100;

const prisma = new PrismaClient();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function loadTableRows(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const table = raw.find((entry) => entry.type === 'table');
  if (!table) throw new Error(`No "table" entry found in ${filePath}`);
  return table.data;
}

/** MySQL "YYYY-MM-DD HH:MM:SS" has no timezone — treated as UTC so the conversion is deterministic. */
function toUtcDate(mysqlDateTime) {
  if (!mysqlDateTime) return null;
  return new Date(mysqlDateTime.replace(' ', 'T') + 'Z');
}

function present(v) {
  return v != null && String(v).trim() !== '';
}

const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
function guessMime(filename) {
  return MIME_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}

/** Mirrors StorageService.sanitizeObjectKey — Supabase Storage rejects keys with anything outside a narrow safe set. */
function sanitizeObjectKey(objPath) {
  return objPath
    .split('/')
    .map((seg) =>
      seg
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[-.]+|[-.]+$/g, ''),
    )
    .filter(Boolean)
    .join('/');
}

const uploadStats = { uploaded: 0, uploadedBytes: 0, missing: [], failed: [] };

/** Reads the local file the legacy `relJsonPath` points at and uploads it to Supabase Storage; returns the public URL, or null if the file wasn't found/failed. */
async function uploadIfPresent(bucket, destPath, relJsonPath, context) {
  if (!present(relJsonPath)) return null;
  const localPath = path.join(STORAGE_BASE, relJsonPath);
  if (!fs.existsSync(localPath)) {
    uploadStats.missing.push({ ...context, bucket, relJsonPath });
    return null;
  }

  const buffer = fs.readFileSync(localPath);
  const mimetype = guessMime(localPath);
  const key = sanitizeObjectKey(destPath);

  let { error } = await supabase.storage.from(bucket).upload(key, buffer, { contentType: mimetype, upsert: true });
  if (error && /bucket not found/i.test(error.message)) {
    await supabase.storage.createBucket(bucket, { public: true }).catch(() => {});
    ({ error } = await supabase.storage.from(bucket).upload(key, buffer, { contentType: mimetype, upsert: true }));
  }
  if (error) {
    uploadStats.failed.push({ ...context, bucket, relJsonPath, error: error.message });
    return null;
  }

  uploadStats.uploaded += 1;
  uploadStats.uploadedBytes += buffer.length;
  const { data } = supabase.storage.from(bucket).getPublicUrl(key);
  return data.publicUrl;
}

/** Runs async `worker` over `items` with bounded concurrency, preserving result order. */
async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const total = items.length;
  async function lane() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
      done += 1;
      if (done % 25 === 0 || done === total) {
        console.log(`  uploads: ${done}/${total}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, lane));
  return results;
}

function mapSubscriptionType(old) {
  return String(old || '').toLowerCase() === 'fulltime' ? 'FULL_TIME_ACCESS' : 'SUBSCRIPTION';
}

/** The old `order` column is "1" on every single row (uninformative) — real reading order comes from created_at instead. */
function sortByCreatedAt(rows) {
  return [...rows].sort((a, b) => toUtcDate(a.created_at) - toUtcDate(b.created_at));
}

async function insertInChunks(model, rows, label) {
  for (let i = 0; i < rows.length; i += DB_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + DB_CHUNK_SIZE);
    await prisma[model].createMany({ data: chunk, skipDuplicates: true });
    console.log(`  ${label}: inserted ${Math.min(i + DB_CHUNK_SIZE, rows.length)}/${rows.length}`);
  }
}

async function main() {
  console.log('Reading source JSON files...');
  const bookRows = loadTableRows(BOOKS_PATH);
  const chapterRowsRaw = loadTableRows(CHAPTERS_PATH);
  const topicRowsRaw = loadTableRows(TOPICS_PATH);
  console.log(`  source counts -> books: ${bookRows.length}, chapters: ${chapterRowsRaw.length}, topics: ${topicRowsRaw.length}`);

  const bookIdSet = new Set(bookRows.map((b) => b.id));
  const danglingChapters = chapterRowsRaw.filter((c) => !bookIdSet.has(c.book_id));
  const chapterRows = sortByCreatedAt(chapterRowsRaw.filter((c) => bookIdSet.has(c.book_id)));
  const chapterIdSet = new Set(chapterRows.map((c) => c.id));
  const danglingTopics = topicRowsRaw.filter((t) => !chapterIdSet.has(t.chapter_id));
  const topicRows = sortByCreatedAt(topicRowsRaw.filter((t) => chapterIdSet.has(t.chapter_id)));

  if (danglingChapters.length || danglingTopics.length) {
    console.log(
      `  skipping ${danglingChapters.length} chapter(s) with no matching book and ${danglingTopics.length} topic(s) with no matching chapter`,
    );
  }

  const bookIdMap = {}; // old book id -> new uuid
  const chapterIdMap = {}; // old chapter id -> new uuid
  const topicIdMap = {}; // old topic id -> new uuid

  // --- Books: upload cover + merged PDF, then build create rows ---
  console.log('\nUploading book covers & merged PDFs...');
  const bookCreateRows = [];
  for (const b of bookRows) {
    const newId = crypto.randomUUID();
    bookIdMap[b.id] = newId;

    const coverUrl = await uploadIfPresent(
      'book-covers',
      `${newId}/${path.basename(b.cover_image || 'cover')}`,
      b.cover_image,
      { type: 'book', oldId: b.id, field: 'cover_image' },
    );
    const pdfUrl = await uploadIfPresent(
      'book-pdfs',
      `${newId}/${path.basename(b.merged_pdf || 'book.pdf')}`,
      b.merged_pdf,
      { type: 'book', oldId: b.id, field: 'merged_pdf' },
    );

    const isFreeBook = b.is_free === '1';
    const price = isFreeBook ? 0 : Number(b.price) || 0;
    const discountPercent = isFreeBook ? 0 : Math.min(100, Math.max(0, Number(b.discount) || 0));
    const finalPrice = isFreeBook ? 0 : Math.round(price - (price * discountPercent) / 100);

    bookCreateRows.push({
      id: newId,
      title: b.title,
      author: b.author || '',
      description: b.description || '',
      coverUrl: coverUrl || '',
      pdfUrl,
      price,
      discountPercent,
      finalPrice,
      category: b.category || 'General',
      publicationYear: b.publication_year ? Number(b.publication_year) : undefined,
      productId: present(b.product_id) ? b.product_id.trim() : undefined,
      appleId: present(b.apple_product_id) ? String(b.apple_product_id).trim() : undefined,
      basePlanId: present(b.base_plan_id) ? b.base_plan_id.trim() : undefined,
      subscriptionType: mapSubscriptionType(b.subscription_type),
      isPremium: !isFreeBook && finalPrice > 0,
      isPublished: b.is_active === '1',
      visibleToGuests: b.is_public === '1',
      createdAt: toUtcDate(b.created_at),
      updatedAt: toUtcDate(b.updated_at),
    });
  }

  // --- Chapters: upload audio + pdf, then build create rows ---
  console.log('\nUploading chapter audio & PDFs...');
  const chapterJobs = chapterRows.map((c, idx) => ({ c, idx }));
  const chapterUploads = await runPool(
    chapterJobs,
    async ({ c }) => {
      const newBookId = bookIdMap[c.book_id];
      const newId = crypto.randomUUID();
      chapterIdMap[c.id] = newId;
      const audioUrl = await uploadIfPresent(
        'chapter-audio',
        `${newBookId}/${newId}/${path.basename(c.audio_file || 'audio')}`,
        c.audio_file,
        { type: 'chapter', oldId: c.id, field: 'audio_file' },
      );
      const pdfUrl = await uploadIfPresent(
        'chapter-pdfs',
        `${newBookId}/${newId}/${path.basename(c.pdf_file || 'chapter.pdf')}`,
        c.pdf_file,
        { type: 'chapter', oldId: c.id, field: 'pdf_file' },
      );
      return { newId, newBookId, audioUrl, pdfUrl };
    },
    UPLOAD_CONCURRENCY,
  );

  const chapterCreateRows = chapterRows.map((c, i) => {
    const { newId, newBookId, audioUrl, pdfUrl } = chapterUploads[i];
    return {
      id: newId,
      bookId: newBookId,
      title: c.title,
      description: c.description || '',
      orderIndex: i,
      isActive: c.is_active === '1',
      youtubeUrl: present(c.youtube_link) ? c.youtube_link.trim() : undefined,
      audioUrl,
      pdfUrl,
      createdAt: toUtcDate(c.created_at),
      updatedAt: toUtcDate(c.updated_at),
    };
  });

  // --- Topics: upload audio + pdf, then build create rows ---
  console.log('\nUploading topic audio & PDFs (this is the bulk of the data)...');
  // Track each chapter's running topic count so orderIndex is per-chapter, not global.
  const topicOrderCounter = {};
  const topicUploads = await runPool(
    topicRows,
    async (t) => {
      const newChapterId = chapterIdMap[t.chapter_id];
      const newId = crypto.randomUUID();
      topicIdMap[t.id] = newId;
      const audioUrl = await uploadIfPresent(
        'topic-audio',
        `${newId}/${path.basename(t.audio_file || 'audio')}`,
        t.audio_file,
        { type: 'topic', oldId: t.id, field: 'audio_file' },
      );
      const pdfUrl = await uploadIfPresent(
        'topic-pdfs',
        `${newId}/${path.basename(t.pdf_file || 'topic.pdf')}`,
        t.pdf_file,
        { type: 'topic', oldId: t.id, field: 'pdf_file' },
      );
      return { newId, newChapterId, audioUrl, pdfUrl };
    },
    UPLOAD_CONCURRENCY,
  );

  const topicCreateRows = topicRows.map((t, i) => {
    const { newId, newChapterId, audioUrl, pdfUrl } = topicUploads[i];
    const orderIndex = topicOrderCounter[newChapterId] ?? 0;
    topicOrderCounter[newChapterId] = orderIndex + 1;
    return {
      id: newId,
      chapterId: newChapterId,
      title: t.title,
      description: t.description || '',
      orderIndex,
      isActive: t.is_active === '1',
      youtubeUrl: present(t.youtube_link) ? t.youtube_link.trim() : undefined,
      audioUrl,
      pdfUrl,
      createdAt: toUtcDate(t.created_at),
      updatedAt: toUtcDate(t.updated_at),
    };
  });

  console.log(`\nInserting ${bookCreateRows.length} books...`);
  await insertInChunks('book', bookCreateRows, 'books');

  console.log(`\nInserting ${chapterCreateRows.length} chapters...`);
  await insertInChunks('chapter', chapterCreateRows, 'chapters');

  console.log(`\nInserting ${topicCreateRows.length} topics...`);
  await insertInChunks('topic', topicCreateRows, 'topics');

  // --- Verification ---
  const [dbBookCount, dbChapterCount, dbTopicCount] = await Promise.all([
    prisma.book.count({ where: { id: { in: Object.values(bookIdMap) } } }),
    prisma.chapter.count({ where: { id: { in: Object.values(chapterIdMap) } } }),
    prisma.topic.count({ where: { id: { in: Object.values(topicIdMap) } } }),
  ]);

  console.log('\n=== Verification ===');
  console.log(`Books:    source ${bookRows.length} | inserted in DB ${dbBookCount}`);
  console.log(`Chapters: source ${chapterRowsRaw.length} | importable ${chapterRows.length} | inserted in DB ${dbChapterCount} | skipped ${danglingChapters.length}`);
  console.log(`Topics:   source ${topicRowsRaw.length} | importable ${topicRows.length} | inserted in DB ${dbTopicCount} | skipped ${danglingTopics.length}`);
  console.log(
    `\nFiles: uploaded ${uploadStats.uploaded} (${(uploadStats.uploadedBytes / (1024 * 1024)).toFixed(1)} MB), missing locally ${uploadStats.missing.length}, failed ${uploadStats.failed.length}`,
  );

  const pass = dbBookCount === bookCreateRows.length && dbChapterCount === chapterCreateRows.length && dbTopicCount === topicCreateRows.length;
  console.log(`\nResult: ${pass ? 'PASS — every importable record was written correctly.' : 'MISMATCH — see counts above.'}`);

  // --- Audit trail ---
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'book-id-map.json'), JSON.stringify(bookIdMap, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'chapter-id-map.json'), JSON.stringify(chapterIdMap, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'topic-id-map.json'), JSON.stringify(topicIdMap, null, 2));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'books-summary.json'),
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        source: { books: bookRows.length, chapters: chapterRowsRaw.length, topics: topicRowsRaw.length },
        imported: { books: bookCreateRows.length, chapters: chapterCreateRows.length, topics: topicCreateRows.length },
        skipped: { danglingChapters: danglingChapters.length, danglingTopics: danglingTopics.length },
        files: {
          uploaded: uploadStats.uploaded,
          uploadedMB: Math.round(uploadStats.uploadedBytes / (1024 * 1024)),
          missing: uploadStats.missing,
          failed: uploadStats.failed,
        },
        dbVerified: { books: dbBookCount, chapters: dbChapterCount, topics: dbTopicCount },
      },
      null,
      2,
    ),
  );
  console.log(`\nAudit trail written to ${OUTPUT_DIR}/`);
  if (uploadStats.missing.length) {
    console.log(`\n${uploadStats.missing.length} file(s) referenced in the JSON had no matching local file (left null in the DB) — see books-summary.json "files.missing" for the exact list.`);
  }
  if (uploadStats.failed.length) {
    console.log(`${uploadStats.failed.length} file(s) failed to upload — see books-summary.json "files.failed".`);
  }
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
