#!/usr/bin/env node
/**
 * Migrates users and orders from the legacy PHP/MySQL app into the new
 * Postgres/Prisma database.
 *
 *   node scripts/migrate-legacy-users-orders.js --dry-run
 *   node scripts/migrate-legacy-users-orders.js
 *
 * Design notes
 * ------------
 * - Idempotent. Every imported row is keyed by its legacy primary key
 *   (`legacyId`), so a re-run inserts nothing new and never duplicates an
 *   order. Safe to re-run after a partial failure.
 * - Lossless. The complete original row is stored verbatim in `legacyData`,
 *   so any legacy column without a first-class home in the new schema
 *   (remember_token, batch_id, preferences, payment_details, …) stays
 *   readable.
 * - New primary keys. The app still issues its own uuids; legacy ids live
 *   only in the `legacy*` reference columns.
 * - Timestamps. Legacy datetimes carry no timezone but are UTC: order volume
 *   troughs at 19:00–23:00 raw, i.e. 00:30–04:30 IST, which is overnight for
 *   this (Indian) audience. They are parsed as UTC accordingly.
 *
 * Book access is not a separate table in this app: it is derived from an
 * Order with status SUCCESS for that bookId (see BookAccessService). So
 * mapping a paid legacy order onto the right new bookId *is* the grant.
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
/** Re-run the verification suite against an already-migrated database. */
const VERIFY_ONLY = process.argv.includes('--verify-only');
const WRITE = !DRY_RUN && !VERIFY_ONLY;
const USERS_JSON = process.env.LEGACY_USERS_JSON || '/Users/antoanstin/Downloads/users.json';
const ORDERS_JSON = process.env.LEGACY_ORDERS_JSON || '/Users/antoanstin/Downloads/orders.json';
const OUT_DIR = path.join(__dirname, 'migration-output');

/** Old book id -> new book id, supplied by the product owner. */
const BOOK_ID_MAP = {
  101: '83b937d2-7d71-4331-9a74-af0df8ab52f0', // PSC HOT TOPICS
  113: '5c505d30-e466-41c6-811f-faf5eb8ac598', // NEW SCERT BASIC SCIENCE & SOCIAL SCIENCE (STD 5-10)
};

/**
 * Legacy `status` -> new OrderStatus.
 *
 * `completed` becomes SUCCESS even on the 1,497 rows whose `payment_status`
 * still read `pending` with no payment reference: the legacy app treated
 * `status` as authoritative, so those users already had access and must not
 * lose it. `refunded`/`cancelled` keep their own states and therefore grant
 * no access. The raw pair is preserved in `legacyStatus`/`legacyPaymentStatus`.
 */
const STATUS_MAP = {
  completed: 'SUCCESS',
  pending: 'PENDING',
  processing: 'PENDING',
  refunded: 'REFUNDED',
  cancelled: 'CANCELLED',
  failed: 'FAILED',
};

const CHUNK = 1000;

/**
 * The status an order settles to, applying the one correction the raw legacy
 * `status` column gets: four rows sat at pending with `payment_status=paid`
 * and a real Razorpay payment id, i.e. money captured but the order never
 * advanced. Used by both the import and the verification so the two can never
 * drift apart.
 */
function settledStatus(order, metadata) {
  const m = metadata || parseMetadata(order.metadata);
  const s = STATUS_MAP[order.status] || 'PENDING';
  if (s === 'PENDING' && order.payment_status === 'paid' && m.razorpay_payment_id) return 'SUCCESS';
  return s;
}

// --- helpers ---------------------------------------------------------------

const log = (...a) => console.log(...a);

function readTable(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const table = parsed.find((t) => t && t.type === 'table');
  if (!table) throw new Error(`No table payload found in ${file}`);
  return table.data;
}

/** Legacy datetimes are UTC wall-clock strings; make that explicit. */
function toDate(value) {
  if (!value || value === '0000-00-00 00:00:00') return null;
  const d = new Date(`${String(value).trim().replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateOnly(value) {
  if (!value || value === '0000-00-00') return null;
  const d = new Date(`${String(value).trim()}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseMetadata(raw) {
  if (!raw) return {};
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function createInChunks(label, model, rows) {
  let made = 0;
  const parts = chunk(rows, CHUNK);
  for (let i = 0; i < parts.length; i++) {
    const res = await model.createMany({ data: parts[i], skipDuplicates: true });
    made += res.count;
    process.stdout.write(`\r  ${label}: ${made} inserted (batch ${i + 1}/${parts.length})   `);
  }
  process.stdout.write('\n');
  return made;
}

// --- main ------------------------------------------------------------------

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : VERIFY_ONLY ? 'verify-only' : 'live',
  };

  log(DRY_RUN ? '=== DRY RUN (no writes) ===' : VERIFY_ONLY ? '=== VERIFY ONLY (no writes) ===' : '=== LIVE MIGRATION ===');

  const legacyUsers = readTable(USERS_JSON);
  const legacyOrders = readTable(ORDERS_JSON);
  log(`legacy source: ${legacyUsers.length} users, ${legacyOrders.length} orders`);

  const legacyUserIds = new Set(legacyUsers.map((u) => String(u.id)));

  // Which legacy users hold a settled order? Used to break duplicate-Google
  // ties in favour of the account that actually paid.
  const paidLegacyUserIds = new Set(
    legacyOrders
      .filter((o) => STATUS_MAP[o.status] === 'SUCCESS')
      .map((o) => String(o.user_id)),
  );

  // ---------------------------------------------------------------- books --
  log('\n[1/6] Books');
  const legacyBookIds = [...new Set(legacyOrders.map((o) => String(o.book_id)).filter(Boolean))];

  // Best-known title/slug per legacy book id, taken from order metadata.
  const bookTitles = {};
  for (const o of legacyOrders) {
    const id = String(o.book_id);
    const m = parseMetadata(o.metadata);
    if (!m.book_title) continue;
    bookTitles[id] = bookTitles[id] || {};
    bookTitles[id][m.book_title] = (bookTitles[id][m.book_title] || 0) + 1;
  }
  const bestTitle = (id) => {
    const counts = bookTitles[id];
    if (!counts) return null;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  };
  const modalAmount = (id) => {
    const counts = {};
    for (const o of legacyOrders) {
      if (String(o.book_id) !== id) continue;
      const a = parseFloat(o.amount) || 0;
      counts[a] = (counts[a] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? parseFloat(top[0]) : 0;
  };

  const bookIdMap = {};
  const placeholdersMade = [];

  for (const legacyId of legacyBookIds) {
    if (BOOK_ID_MAP[legacyId]) {
      const newId = BOOK_ID_MAP[legacyId];
      const exists = await prisma.book.findUnique({ where: { id: newId }, select: { id: true } });
      if (!exists) throw new Error(`Mapped book ${newId} (legacy ${legacyId}) not found in the new DB`);
      if (WRITE) {
        await prisma.book.update({ where: { id: newId }, data: { legacyId } });
      }
      bookIdMap[legacyId] = newId;
      log(`  legacy ${legacyId} -> ${newId} (real book, access granted on paid orders)`);
      continue;
    }

    // Not carried across: keep a hidden placeholder so the historical order
    // still references a real book row. Priced and premium so it is paywalled,
    // unpublished and flagged so it never appears in any listing.
    const existing = await prisma.book.findUnique({ where: { legacyId }, select: { id: true } });
    if (existing) {
      bookIdMap[legacyId] = existing.id;
      continue;
    }
    const title = bestTitle(legacyId) || `Legacy book #${legacyId}`;
    const price = modalAmount(legacyId);
    const data = {
      legacyId,
      isLegacyPlaceholder: true,
      title,
      author: 'PSC Tips & Tricks',
      description:
        `Archived listing from the previous application (legacy book id ${legacyId}). ` +
        `Retained so historical orders keep a valid reference. Not available for purchase or reading.`,
      coverUrl: '',
      category: 'Legacy (archived)',
      price,
      finalPrice: price,
      isPremium: true,
      isPublished: false,
      visibleToGuests: false,
    };
    if (!WRITE) {
      bookIdMap[legacyId] = `not-written-placeholder-${legacyId}`;
    } else {
      const made = await prisma.book.create({ data, select: { id: true } });
      bookIdMap[legacyId] = made.id;
    }
    placeholdersMade.push({ legacyId, title, price });
    log(`  legacy ${legacyId} -> placeholder "${title}" (no access)`);
  }
  report.books = { mapped: Object.keys(BOOK_ID_MAP), placeholders: placeholdersMade };

  // ---------------------------------------------------------------- users --
  log('\n[2/6] Users');
  const existingUsers = await prisma.user.findMany({
    select: { id: true, email: true, legacyId: true, password: true, name: true, role: true, phoneNumber: true },
  });
  const byEmail = new Map(existingUsers.map((u) => [u.email.trim().toLowerCase(), u]));
  const byLegacyId = new Map(existingUsers.filter((u) => u.legacyId).map((u) => [u.legacyId, u]));

  const toCreate = [];
  const toUpdate = [];

  for (const lu of legacyUsers) {
    const legacyId = String(lu.id);
    const email = String(lu.email || '').trim().toLowerCase();
    if (!email) continue;

    const { password, ...rest } = lu; // hash lives in `password`, not the blob
    const common = {
      name: (lu.name && lu.name.trim()) || email.split('@')[0],
      role: lu.role === 'admin' ? 'ADMIN' : lu.role === 'staff' ? 'STAFF' : 'STUDENT',
      status: String(lu.is_active) === '0' ? 'SUSPENDED' : 'ACTIVE',
      phoneNumber: lu.mobile_number || lu.phone || null,
      bio: lu.bio || null,
      gender: lu.gender || null,
      dateOfBirth: toDateOnly(lu.date_of_birth),
      lastLoginAt: toDate(lu.last_login_at),
      legacyId,
      legacyData: rest,
    };

    const hit = byLegacyId.get(legacyId) || byEmail.get(email);
    if (hit) {
      // Already present in the new app (they signed up here too). Merge rather
      // than clobber: never downgrade a role, never overwrite a password or a
      // name the user has since set in the new app.
      toUpdate.push({
        id: hit.id,
        data: {
          ...common,
          role: hit.role === 'ADMIN' || hit.role === 'STAFF' ? hit.role : common.role,
          name: hit.name && hit.name.trim() ? hit.name : common.name,
          phoneNumber: hit.phoneNumber || common.phoneNumber,
          ...(hit.password ? {} : { password: lu.password || null }),
        },
      });
    } else {
      toCreate.push({
        email,
        password: lu.password || null,
        ...common,
        createdAt: toDate(lu.created_at) || new Date(),
        updatedAt: toDate(lu.updated_at) || toDate(lu.created_at) || new Date(),
      });
    }
  }

  log(`  to create: ${toCreate.length}, to merge into existing: ${toUpdate.length}`);
  let usersCreated = 0;
  if (WRITE) {
    usersCreated = await createInChunks('users', prisma.user, toCreate);
    for (const u of toUpdate) {
      await prisma.user.update({ where: { id: u.id }, data: u.data });
    }
    log(`  merged ${toUpdate.length} pre-existing accounts`);
  }
  report.users = { legacySource: legacyUsers.length, created: usersCreated, merged: toUpdate.length };

  // ------------------------------------------------------ oauth identities --
  log('\n[3/6] OAuth identities');
  const userIdByLegacyId = new Map();
  if (!DRY_RUN) {
    const all = await prisma.user.findMany({
      where: { legacyId: { not: null } },
      select: { id: true, legacyId: true },
    });
    all.forEach((u) => userIdByLegacyId.set(u.legacyId, u.id));
  }

  // 22 Google ids appear on two legacy accounts each. OAuthIdentity is unique
  // per (provider, providerAccountId), so only one can keep it: prefer the
  // account that paid, then the older one. The loser keeps google_id in
  // legacyData and can still sign in by email.
  const claimed = new Map();
  const oauthConflicts = [];
  const identityRows = [];

  for (const provider of ['GOOGLE', 'APPLE']) {
    const field = provider === 'GOOGLE' ? 'google_id' : 'apple_id';
    const candidates = legacyUsers.filter((u) => u[field]);
    const sorted = [...candidates].sort((a, b) => {
      const ap = paidLegacyUserIds.has(String(a.id)) ? 0 : 1;
      const bp = paidLegacyUserIds.has(String(b.id)) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return String(a.created_at).localeCompare(String(b.created_at));
    });
    for (const lu of sorted) {
      const key = `${provider}:${lu[field]}`;
      if (claimed.has(key)) {
        oauthConflicts.push({
          provider,
          providerAccountId: lu[field],
          keptLegacyUserId: claimed.get(key),
          skippedLegacyUserId: String(lu.id),
          skippedEmail: lu.email,
        });
        continue;
      }
      claimed.set(key, String(lu.id));
      const userId = userIdByLegacyId.get(String(lu.id));
      if (!DRY_RUN && !userId) continue;
      identityRows.push({ provider, providerAccountId: String(lu[field]), userId: userId || 'dry-run' });
    }
  }
  log(`  identities: ${identityRows.length}, skipped duplicate links: ${oauthConflicts.length}`);
  let oauthCreated = 0;
  if (WRITE) oauthCreated = await createInChunks('oauth', prisma.oAuthIdentity, identityRows);
  report.oauth = { created: oauthCreated, conflicts: oauthConflicts.length };

  // --------------------------------------------------------------- orders --
  log('\n[4/6] Orders');
  const orderRows = [];
  const skippedOrphans = [];

  for (const lo of legacyOrders) {
    const legacyUserId = String(lo.user_id);
    if (!legacyUserIds.has(legacyUserId)) {
      // Owner no longer exists in the legacy users export (deleted account).
      // Skipped by explicit instruction; exported in full so nothing is lost.
      skippedOrphans.push(lo);
      continue;
    }
    const userId = userIdByLegacyId.get(legacyUserId);
    if (!DRY_RUN && !userId) {
      skippedOrphans.push({ ...lo, _reason: 'user row missing after import' });
      continue;
    }

    const m = parseMetadata(lo.metadata);
    const legacyBookId = lo.book_id ? String(lo.book_id) : null;
    const status = settledStatus(lo, m);

    orderRows.push({
      userId: userId || 'dry-run',
      bookId: legacyBookId ? bookIdMap[legacyBookId] || null : null,
      amount: parseFloat(lo.amount) || 0,
      currency: lo.currency || 'INR',
      status,
      razorpayOrderId: m.razorpay_order_id || null,
      razorpayPaymentId: m.razorpay_payment_id || null,
      razorpaySignature: m.razorpay_signature || null,
      legacyId: String(lo.id),
      legacyOrderNumber: lo.order_id || null,
      legacyBookId,
      legacyStatus: lo.status || null,
      legacyPaymentStatus: lo.payment_status || null,
      description: lo.description || null,
      accessType: lo.access_type || null,
      validTill: toDate(lo.valid_till),
      paidAt: toDate(lo.paid_at),
      legacyData: { ...lo, metadata: m },
      createdAt: toDate(lo.created_at) || new Date(),
      updatedAt: toDate(lo.updated_at) || toDate(lo.created_at) || new Date(),
    });
  }

  log(`  to insert: ${orderRows.length}, skipped (deleted owner): ${skippedOrphans.length}`);
  fs.writeFileSync(
    path.join(OUT_DIR, 'skipped-orphan-orders.json'),
    JSON.stringify(
      {
        note:
          'Legacy orders whose user_id has no row in users.json (deleted accounts). ' +
          'Skipped at the product owner\'s instruction; retained here in full so the payment history is recoverable.',
        count: skippedOrphans.length,
        orders: skippedOrphans,
      },
      null,
      2,
    ),
  );

  let ordersCreated = 0;
  if (WRITE) ordersCreated = await createInChunks('orders', prisma.order, orderRows);
  report.orders = {
    legacySource: legacyOrders.length,
    prepared: orderRows.length,
    created: ordersCreated,
    skippedOrphans: skippedOrphans.length,
  };

  // -------------------------------------------------------------- premium --
  log('\n[5/6] Premium flags');
  if (WRITE) {
    const n = await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "isPremium" = true
       WHERE "isPremium" = false
         AND "id" IN (SELECT DISTINCT "userId" FROM "Order" WHERE "status" = 'SUCCESS')`,
    );
    log(`  marked ${n} users premium`);
    report.premiumMarked = n;
  }

  // --------------------------------------------------------- verification --
  log('\n[6/6] Verification');
  const verification = await verify(legacyUsers, legacyOrders, bookIdMap, skippedOrphans, oauthConflicts);
  report.verification = verification;
  report.finishedAt = new Date().toISOString();

  // A verify-only pass must not overwrite the record of the real migration:
  // in that mode every user already exists, so its create/merge counts describe
  // nothing that happened.
  const reportFile = VERIFY_ONLY ? 'verification-report.json' : 'migration-report.json';
  if (VERIFY_ONLY) {
    delete report.users;
    delete report.orders.created;
    delete report.oauth;
  }
  fs.writeFileSync(path.join(OUT_DIR, reportFile), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(OUT_DIR, 'oauth-duplicate-links.json'),
    JSON.stringify({ count: oauthConflicts.length, conflicts: oauthConflicts }, null, 2),
  );
  log(`\nreport written to ${path.join(OUT_DIR, reportFile)}`);
}

async function verify(legacyUsers, legacyOrders, bookIdMap, skippedOrphans, oauthConflicts) {
  const v = {};
  const pass = [];
  const fail = [];
  const check = (name, ok, detail) => {
    (ok ? pass : fail).push({ name, detail });
    log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  };

  const skippedIds = new Set(skippedOrphans.map((s) => String(s.id)));

  const dbUsers = await prisma.user.count();
  const dbLegacyUsers = await prisma.user.count({ where: { legacyId: { not: null } } });
  const dbOrders = await prisma.order.count();
  const dbLegacyOrders = await prisma.order.count({ where: { legacyId: { not: null } } });

  v.users = { legacy: legacyUsers.length, migrated: dbLegacyUsers, totalInDb: dbUsers };
  v.orders = {
    legacy: legacyOrders.length,
    expected: legacyOrders.length - skippedOrphans.length,
    migrated: dbLegacyOrders,
    totalInDb: dbOrders,
  };

  check('every legacy user migrated', dbLegacyUsers === legacyUsers.length,
    `${dbLegacyUsers}/${legacyUsers.length}`);
  check('every non-orphan legacy order migrated',
    dbLegacyOrders === legacyOrders.length - skippedOrphans.length,
    `${dbLegacyOrders}/${legacyOrders.length - skippedOrphans.length} (${skippedOrphans.length} orphans skipped by instruction)`);

  // Status distribution must match the legacy source exactly.
  const expectedStatus = {};
  for (const o of legacyOrders) {
    if (skippedIds.has(String(o.id))) continue;
    const m = parseMetadata(o.metadata);
    const s = settledStatus(o, m);
    expectedStatus[s] = (expectedStatus[s] || 0) + 1;
  }
  const actualStatus = {};
  for (const g of await prisma.order.groupBy({
    by: ['status'],
    where: { legacyId: { not: null } },
    _count: true,
  })) {
    actualStatus[g.status] = g._count;
  }
  v.statusDistribution = { expected: expectedStatus, actual: actualStatus };
  const statusOk = Object.keys(expectedStatus).every((k) => expectedStatus[k] === actualStatus[k]);
  check('order status distribution matches', statusOk, JSON.stringify(actualStatus));

  // Book access: a paid legacy order for 101/113 must yield a SUCCESS order
  // on the mapped new book for that user.
  v.access = {};
  for (const [legacyBookId, newBookId] of Object.entries(BOOK_ID_MAP)) {
    const expectedUsers = new Set(
      legacyOrders
        .filter((o) => String(o.book_id) === legacyBookId && settledStatus(o) === 'SUCCESS')
        .filter((o) => !skippedIds.has(String(o.id)))
        .map((o) => String(o.user_id)),
    );
    const rows = await prisma.order.findMany({
      where: { bookId: newBookId, status: 'SUCCESS' },
      select: { userId: true },
      distinct: ['userId'],
    });
    v.access[legacyBookId] = {
      newBookId,
      legacyUsersWithPaidOrder: expectedUsers.size,
      usersWithAccessNow: rows.length,
    };
    check(`book ${legacyBookId} access granted`, rows.length >= expectedUsers.size,
      `${rows.length} users have access (>= ${expectedUsers.size} expected from legacy)`);
  }

  // No refunded/cancelled order may be the sole basis of access.
  const badGrant = await prisma.order.count({
    where: { status: 'SUCCESS', legacyStatus: { in: ['refunded', 'cancelled'] } },
  });
  check('no refunded/cancelled order marked SUCCESS', badGrant === 0, `${badGrant} found`);

  // Placeholder books must never grant a browsable/readable product.
  const placeholders = await prisma.book.findMany({
    where: { isLegacyPlaceholder: true },
    select: { id: true, legacyId: true, title: true, isPublished: true, visibleToGuests: true, pdfUrl: true },
  });
  v.placeholders = placeholders;
  check('placeholder books unpublished & hidden',
    placeholders.every((b) => !b.isPublished && !b.visibleToGuests && !b.pdfUrl),
    `${placeholders.length} placeholders`);

  // Referential integrity. The userId foreign key already guarantees an owner
  // exists, so the open question is whether every imported order landed on the
  // *right* owner — i.e. one carrying the matching legacy user id.
  const misowned = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c
       FROM "Order" o JOIN "User" u ON u.id = o."userId"
      WHERE o."legacyId" IS NOT NULL
        AND (u."legacyId" IS NULL
             OR u."legacyId" <> (o."legacyData"->>'user_id'))`,
  );
  check('every order linked to its original owner', misowned[0].c === 0,
    `${misowned[0].c} mismatched`);

  const noBook = await prisma.order.count({
    where: { legacyId: { not: null }, legacyBookId: { not: null }, bookId: null },
  });
  check('all imported orders resolve to a book', noBook === 0, `${noBook} unresolved`);

  const dupLegacy = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM (
       SELECT "legacyId" FROM "Order" WHERE "legacyId" IS NOT NULL
       GROUP BY "legacyId" HAVING COUNT(*) > 1) x`,
  );
  check('no duplicated legacy orders', dupLegacy[0].c === 0, `${dupLegacy[0].c} duplicates`);

  // Money preserved. Uses the same settled-order rule the migration applies,
  // including the four captured-but-never-advanced payments.
  const legacyPaidTotal = legacyOrders
    .filter((o) => !skippedIds.has(String(o.id)))
    .filter((o) => settledStatus(o) === 'SUCCESS')
    .reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);
  const dbPaid = await prisma.order.aggregate({
    where: { legacyId: { not: null }, status: 'SUCCESS' },
    _sum: { amount: true },
  });
  v.paidRevenue = { legacy: Math.round(legacyPaidTotal * 100) / 100, migrated: dbPaid._sum.amount };
  check('settled revenue preserved',
    Math.abs((dbPaid._sum.amount || 0) - legacyPaidTotal) < 1,
    `legacy ₹${legacyPaidTotal.toFixed(2)} vs migrated ₹${(dbPaid._sum.amount || 0).toFixed(2)}`);

  v.oauthConflicts = oauthConflicts.length;
  v.passed = pass.length;
  v.failed = fail.length;
  v.failures = fail;
  log(`\n  ${pass.length} checks passed, ${fail.length} failed`);
  return v;
}

main()
  .catch((e) => {
    console.error('\nMIGRATION FAILED:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
