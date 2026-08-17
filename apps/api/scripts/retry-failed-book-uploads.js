/**
 * Retries the file uploads that failed with a transient error during
 * migrate-legacy-books.js (network hiccups under concurrency, not missing
 * files), and patches the already-created rows with the resulting URL.
 * Run from apps/api: node scripts/retry-failed-book-uploads.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const STORAGE_BASE =
  process.argv[2] ||
  '/Users/antoanstin/Downloads/web 2/psctipsandtricks.com/public_html/storage/app/public';
const OUTPUT_DIR = path.join(__dirname, 'migration-output');
const RETRY_ATTEMPTS = 3;

const prisma = new PrismaClient();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MIME_TYPES = { '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };
function guessMime(filename) {
  return MIME_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}
function sanitizeObjectKey(objPath) {
  return objPath
    .split('/')
    .map((seg) => seg.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, ''))
    .filter(Boolean)
    .join('/');
}

async function uploadWithRetry(bucket, destPath, localPath) {
  const buffer = fs.readFileSync(localPath);
  const mimetype = guessMime(localPath);
  const key = sanitizeObjectKey(destPath);
  let lastError;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const { error } = await supabase.storage.from(bucket).upload(key, buffer, { contentType: mimetype, upsert: true });
    if (!error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(key);
      return data.publicUrl;
    }
    lastError = error;
    console.log(`  attempt ${attempt} failed for ${key}: ${error.message}`);
  }
  throw lastError;
}

async function main() {
  const summary = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'books-summary.json'), 'utf8'));
  const topicIdMap = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'topic-id-map.json'), 'utf8'));
  const chapterIdMap = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'chapter-id-map.json'), 'utf8'));
  const bookIdMap = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'book-id-map.json'), 'utf8'));

  const failed = summary.files.failed;
  console.log(`Retrying ${failed.length} failed upload(s)...`);

  let succeeded = 0;
  const stillFailed = [];

  for (const job of failed) {
    const localPath = path.join(STORAGE_BASE, job.relJsonPath);
    if (!fs.existsSync(localPath)) {
      stillFailed.push({ ...job, error: 'local file missing on retry (unexpected)' });
      continue;
    }

    try {
      let url, updateResult;
      if (job.type === 'topic') {
        const newId = topicIdMap[job.oldId];
        const destPath = `${newId}/${path.basename(job.relJsonPath)}`;
        url = await uploadWithRetry(job.bucket, destPath, localPath);
        const field = job.field === 'audio_file' ? 'audioUrl' : 'pdfUrl';
        updateResult = await prisma.topic.update({ where: { id: newId }, data: { [field]: url } });
      } else if (job.type === 'chapter') {
        const newId = chapterIdMap[job.oldId];
        const chapter = await prisma.chapter.findUnique({ where: { id: newId } });
        const destPath = `${chapter.bookId}/${newId}/${path.basename(job.relJsonPath)}`;
        url = await uploadWithRetry(job.bucket, destPath, localPath);
        const field = job.field === 'audio_file' ? 'audioUrl' : 'pdfUrl';
        updateResult = await prisma.chapter.update({ where: { id: newId }, data: { [field]: url } });
      } else if (job.type === 'book') {
        const newId = bookIdMap[job.oldId];
        const destPath = `${newId}/${path.basename(job.relJsonPath)}`;
        url = await uploadWithRetry(job.bucket, destPath, localPath);
        const field = job.field === 'cover_image' ? 'coverUrl' : 'pdfUrl';
        updateResult = await prisma.book.update({ where: { id: newId }, data: { [field]: url } });
      }
      succeeded += 1;
      console.log(`  OK: ${job.type} ${job.oldId} ${job.field}`);
    } catch (err) {
      stillFailed.push({ ...job, error: err.message || String(err) });
      console.log(`  STILL FAILED: ${job.type} ${job.oldId} ${job.field} — ${err.message}`);
    }
  }

  console.log(`\nRetried ${failed.length}: ${succeeded} succeeded, ${stillFailed.length} still failed.`);
  summary.files.failed = stillFailed;
  summary.files.uploaded += succeeded;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'books-summary.json'), JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error('Retry failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
