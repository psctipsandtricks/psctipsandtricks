/**
 * Follow-up to migrate-legacy-books.js: the user re-supplied a newer copy of
 * the storage dump. This uploads only the specific file references that were
 * missing from the first migration and are now present in the new dump, and
 * patches the already-created rows with the resulting URL. Doesn't touch
 * anything already uploaded. Run from apps/api:
 *   node scripts/upload-newly-found-files.js [storageBaseDir]
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const STORAGE_BASE =
  process.argv[2] ||
  '/Users/antoanstin/Downloads/web 3/psctipsandtricks.com/public_html/storage/app/public';
const OUTPUT_DIR = path.join(__dirname, 'migration-output');

const prisma = new PrismaClient();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MIME_TYPES = { '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
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

async function uploadWithRetry(bucket, destPath, localPath, attempts = 3) {
  const buffer = fs.readFileSync(localPath);
  const mimetype = guessMime(localPath);
  const key = sanitizeObjectKey(destPath);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
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

  const stillMissing = [];
  const targets = [];
  for (const job of summary.files.missing) {
    const localPath = path.join(STORAGE_BASE, job.relJsonPath);
    if (fs.existsSync(localPath)) {
      targets.push(job);
    } else {
      stillMissing.push(job);
    }
  }

  console.log(`${summary.files.missing.length} previously missing — ${targets.length} now found in the new dump, ${stillMissing.length} still absent.`);

  let succeeded = 0;
  const failedThisRun = [];

  for (const job of targets) {
    const localPath = path.join(STORAGE_BASE, job.relJsonPath);
    try {
      let url;
      if (job.type === 'topic') {
        const newId = topicIdMap[job.oldId];
        url = await uploadWithRetry(job.bucket, `${newId}/${path.basename(job.relJsonPath)}`, localPath);
        const field = job.field === 'audio_file' ? 'audioUrl' : 'pdfUrl';
        await prisma.topic.update({ where: { id: newId }, data: { [field]: url } });
      } else if (job.type === 'chapter') {
        const newId = chapterIdMap[job.oldId];
        const chapter = await prisma.chapter.findUnique({ where: { id: newId } });
        url = await uploadWithRetry(job.bucket, `${chapter.bookId}/${newId}/${path.basename(job.relJsonPath)}`, localPath);
        const field = job.field === 'audio_file' ? 'audioUrl' : 'pdfUrl';
        await prisma.chapter.update({ where: { id: newId }, data: { [field]: url } });
      } else if (job.type === 'book') {
        const newId = bookIdMap[job.oldId];
        url = await uploadWithRetry(job.bucket, `${newId}/${path.basename(job.relJsonPath)}`, localPath);
        const field = job.field === 'cover_image' ? 'coverUrl' : 'pdfUrl';
        await prisma.book.update({ where: { id: newId }, data: { [field]: url } });
      }
      succeeded += 1;
      console.log(`  OK: ${job.type} ${job.oldId} ${job.field}`);
    } catch (err) {
      failedThisRun.push({ ...job, error: err.message || String(err) });
      console.log(`  FAILED: ${job.type} ${job.oldId} ${job.field} — ${err.message}`);
    }
  }

  console.log(`\n${succeeded}/${targets.length} uploaded successfully.`);

  summary.files.missing = [...stillMissing, ...failedThisRun];
  summary.files.uploaded += succeeded;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'books-summary.json'), JSON.stringify(summary, null, 2));
  console.log(`Remaining missing: ${summary.files.missing.length}`);
  for (const m of summary.files.missing) {
    console.log(`  - ${m.type} ${m.oldId} ${m.field}: ${m.relJsonPath}`);
  }
}

main()
  .catch((err) => {
    console.error('Upload failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
