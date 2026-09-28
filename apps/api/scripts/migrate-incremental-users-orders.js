#!/usr/bin/env node
/**
 * Incremental migration of users and orders (last ~45 days) from legacy
 * PHP/MySQL app into the Postgres/Prisma database.
 *
 * Usage:
 *   node scripts/migrate-incremental-users-orders.js --dry-run
 *   node scripts/migrate-incremental-users-orders.js
 *   node scripts/migrate-incremental-users-orders.js --verify-only
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const VERIFY_ONLY = process.argv.includes('--verify-only');
const WRITE = !DRY_RUN && !VERIFY_ONLY;

const USERS_JSON = process.env.LEGACY_USERS_JSON || '/Users/antoanstin/Downloads/users.json';
const ORDERS_JSON = process.env.LEGACY_ORDERS_JSON || '/Users/antoanstin/Downloads/orders.json';
const OUT_DIR = path.join(__dirname, 'migration-output');

// Cutoff date for the last ~45 days (August 14, 2026 00:00:00 UTC)
const CUTOFF_DATE = new Date('2026-08-14T00:00:00Z');

/** Old book id -> new book id mapping */
const BOOK_ID_MAP = {
  101: '83b937d2-7d71-4331-9a74-af0df8ab52f0', // PSC HOT TOPICS
  113: '5c505d30-e466-41c6-811f-faf5eb8ac598', // NEW SCERT BASIC SCIENCE & SOCIAL SCIENCE (STD 5-10)
};

const STATUS_MAP = {
  completed: 'SUCCESS',
  pending: 'PENDING',
  processing: 'PENDING',
  refunded: 'REFUNDED',
  cancelled: 'CANCELLED',
  failed: 'FAILED',
};

const CHUNK = 500;

function settledStatus(order, metadata) {
  const m = metadata || parseMetadata(order.metadata);
  const s = STATUS_MAP[order.status] || 'PENDING';
  if (s === 'PENDING' && order.payment_status === 'paid' && m.razorpay_payment_id) return 'SUCCESS';
  return s;
}

const log = (...a) => console.log(...a);

function readTable(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const table = parsed.find((t) => t && t.type === 'table');
  if (!table) throw new Error(`No table payload found in ${file}`);
  return table.data;
}

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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : VERIFY_ONLY ? 'verify-only' : 'live',
    cutoffDate: CUTOFF_DATE.toISOString(),
  };

  log(DRY_RUN ? '=== INCREMENTAL DRY RUN (no writes) ===' : VERIFY_ONLY ? '=== VERIFY ONLY (no writes) ===' : '=== INCREMENTAL LIVE MIGRATION ===');
  log(`Cutoff window: >= ${CUTOFF_DATE.toISOString()} (last ~45 days)`);

  const legacyUsers = readTable(USERS_JSON);
  const legacyOrders = readTable(ORDERS_JSON);
  log(`legacy source: ${legacyUsers.length} total users, ${legacyOrders.length} total orders`);

  const legacyUserMap = new Map(legacyUsers.map((u) => [String(u.id), u]));

  // Track users holding settled orders to break OAuth duplicate ties
  const paidLegacyUserIds = new Set(
    legacyOrders
      .filter((o) => settledStatus(o) === 'SUCCESS')
      .map((o) => String(o.user_id)),
  );

  // Snapshot before migration if live
  if (WRITE) {
    const preUsers = await prisma.user.count();
    const preLegacyUsers = await prisma.user.count({ where: { legacyId: { not: null } } });
    const preOrders = await prisma.order.count();
    const preLegacyOrders = await prisma.order.count({ where: { legacyId: { not: null } } });
    const preRevenue = await prisma.order.aggregate({
      where: { legacyId: { not: null }, status: 'SUCCESS' },
      _sum: { amount: true },
    });
    fs.writeFileSync(
      path.join(OUT_DIR, 'pre-incremental-migration-backup.json'),
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          users: { total: preUsers, legacy: preLegacyUsers },
          orders: { total: preOrders, legacy: preLegacyOrders },
          settledRevenue: preRevenue._sum.amount,
        },
        null,
        2,
      ),
    );
    log(`  saved pre-migration snapshot to pre-incremental-migration-backup.json`);
  }

  // ---------------------------------------------------------------- books --
  log('\n[1/6] Books');
  const bookIdMap = {};
  const placeholdersMade = [];

  const legacyBookIds = [...new Set(legacyOrders.map((o) => String(o.book_id)).filter(Boolean))];
  const dbBooks = await prisma.book.findMany({ select: { id: true, legacyId: true, isLegacyPlaceholder: true } });
  const dbBookByLegacyId = new Map(dbBooks.filter(b => b.legacyId).map(b => [b.legacyId, b]));

  for (const legacyId of legacyBookIds) {
    if (BOOK_ID_MAP[legacyId]) {
      const newId = BOOK_ID_MAP[legacyId];
      const exists = await prisma.book.findUnique({ where: { id: newId }, select: { id: true } });
      if (!exists) throw new Error(`Mapped book ${newId} (legacy ${legacyId}) not found in the DB`);
      if (WRITE) {
        await prisma.book.update({ where: { id: newId }, data: { legacyId } });
      }
      bookIdMap[legacyId] = newId;
      log(`  legacy ${legacyId} -> ${newId} (real book, access granted on paid orders)`);
      continue;
    }

    const existing = dbBookByLegacyId.get(legacyId);
    if (existing) {
      bookIdMap[legacyId] = existing.id;
      continue;
    }

    // Best-known title from order metadata
    let title = `Legacy book #${legacyId}`;
    for (const o of legacyOrders) {
      if (String(o.book_id) === legacyId) {
        const m = parseMetadata(o.metadata);
        if (m.book_title) {
          title = m.book_title;
          break;
        }
      }
    }

    const data = {
      legacyId,
      isLegacyPlaceholder: true,
      title,
      author: 'PSC Tips & Tricks',
      description: `Archived listing from previous application (legacy book id ${legacyId}).`,
      coverUrl: '',
      category: 'Legacy (archived)',
      price: 0,
      finalPrice: 0,
      isPremium: true,
      isPublished: false,
      visibleToGuests: false,
    };

    if (!WRITE) {
      bookIdMap[legacyId] = `placeholder-${legacyId}`;
    } else {
      const made = await prisma.book.create({ data, select: { id: true } });
      bookIdMap[legacyId] = made.id;
    }
    placeholdersMade.push({ legacyId, title });
    log(`  legacy ${legacyId} -> placeholder "${title}" (no access)`);
  }
  report.books = { mapped: Object.keys(BOOK_ID_MAP), placeholders: placeholdersMade };

  // ---------------------------------------------------------------- users --
  log('\n[2/6] Users (Incremental)');
  const existingUsers = await prisma.user.findMany({
    select: { id: true, email: true, legacyId: true, password: true, name: true, role: true, phoneNumber: true, updatedAt: true },
  });
  const byEmail = new Map(existingUsers.map((u) => [u.email.trim().toLowerCase(), u]));
  const byLegacyId = new Map(existingUsers.filter((u) => u.legacyId).map((u) => [u.legacyId, u]));

  const toCreateUsers = [];
  const toUpdateUsers = [];

  for (const lu of legacyUsers) {
    const legacyId = String(lu.id);
    const email = String(lu.email || '').trim().toLowerCase();
    if (!email) continue;

    const uCreatedAt = toDate(lu.created_at);
    const uUpdatedAt = toDate(lu.updated_at);

    const hit = byLegacyId.get(legacyId) || byEmail.get(email);

    const { password, ...rest } = lu;
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

    if (hit) {
      // Check if updated in the last ~45 days
      if (uUpdatedAt && uUpdatedAt >= CUTOFF_DATE) {
        toUpdateUsers.push({
          id: hit.id,
          legacyId,
          data: {
            ...common,
            role: hit.role === 'ADMIN' || hit.role === 'STAFF' ? hit.role : common.role,
            name: hit.name && hit.name.trim() ? hit.name : common.name,
            phoneNumber: hit.phoneNumber || common.phoneNumber,
            ...(hit.password ? {} : { password: lu.password || null }),
            updatedAt: uUpdatedAt,
          },
        });
      }
    } else {
      toCreateUsers.push({
        email,
        password: lu.password || null,
        ...common,
        createdAt: uCreatedAt || new Date(),
        updatedAt: uUpdatedAt || uCreatedAt || new Date(),
      });
    }
  }

  log(`  to create: ${toCreateUsers.length}, to update (updated in last 45 days): ${toUpdateUsers.length}`);

  let usersCreated = 0;
  let usersUpdated = 0;
  if (WRITE) {
    usersCreated = await createInChunks('users', prisma.user, toCreateUsers);
    for (let i = 0; i < toUpdateUsers.length; i++) {
      const u = toUpdateUsers[i];
      await prisma.user.update({ where: { id: u.id }, data: u.data });
      process.stdout.write(`\r  updating users: ${i + 1}/${toUpdateUsers.length}   `);
    }
    process.stdout.write('\n');
    usersUpdated = toUpdateUsers.length;
    log(`  updated ${usersUpdated} existing accounts`);
  }
  report.users = {
    legacyTotalInExport: legacyUsers.length,
    newToCreate: toCreateUsers.length,
    created: usersCreated,
    toUpdate: toUpdateUsers.length,
    updated: usersUpdated,
  };

  // Re-fetch all users to map legacyId -> new uuid
  log('\n[3/6] OAuth identities');
  const userIdByLegacyId = new Map();
  if (WRITE) {
    const allUsers = await prisma.user.findMany({
      where: { legacyId: { not: null } },
      select: { id: true, legacyId: true },
    });
    allUsers.forEach((u) => userIdByLegacyId.set(u.legacyId, u.id));
  } else {
    // For dry-run: keep whatever existing users we have
    existingUsers.filter(u => u.legacyId).forEach(u => userIdByLegacyId.set(u.legacyId, u.id));
  }

  // Find all existing OAuth identities in DB to avoid collisions
  const existingIdentities = await prisma.oAuthIdentity.findMany({
    select: { provider: true, providerAccountId: true, userId: true },
  });
  const existingIdentityMap = new Set(existingIdentities.map(i => `${i.provider}:${i.providerAccountId}`));
  const userHasProviderMap = new Set(existingIdentities.map(i => `${i.userId}:${i.provider}`));

  const identityRows = [];
  const oauthConflicts = [];
  const claimedInRun = new Map();

  // Process OAuth for new users
  for (const lu of toCreateUsers) {
    const legacyId = String(lu.legacyId);
    const userId = userIdByLegacyId.get(legacyId);
    if (WRITE && !userId) continue;

    for (const provider of ['GOOGLE', 'APPLE']) {
      const field = provider === 'GOOGLE' ? 'google_id' : 'apple_id';
      const rawUser = legacyUserMap.get(legacyId);
      if (!rawUser || !rawUser[field]) continue;

      const accountId = String(rawUser[field]);
      const key = `${provider}:${accountId}`;

      if (existingIdentityMap.has(key)) continue; // already linked
      if (claimedInRun.has(key)) {
        oauthConflicts.push({
          provider,
          providerAccountId: accountId,
          keptLegacyUserId: claimedInRun.get(key),
          skippedLegacyUserId: legacyId,
          skippedEmail: lu.email,
        });
        continue;
      }

      if (userId && userHasProviderMap.has(`${userId}:${provider}`)) continue;

      claimedInRun.set(key, legacyId);
      identityRows.push({
        provider,
        providerAccountId: accountId,
        userId: userId || 'dry-run',
      });
    }
  }

  log(`  identities to insert: ${identityRows.length}, skipped duplicate links: ${oauthConflicts.length}`);
  let oauthCreated = 0;
  if (WRITE) oauthCreated = await createInChunks('oauth', prisma.oAuthIdentity, identityRows);
  report.oauth = { created: oauthCreated, conflicts: oauthConflicts.length };

  // --------------------------------------------------------------- orders --
  log('\n[4/6] Orders (Incremental)');
  const dbOrders = await prisma.order.findMany({
    select: { id: true, legacyId: true, legacyOrderNumber: true, status: true, updatedAt: true, userId: true },
  });
  const dbOrderByLegacyId = new Map(dbOrders.filter((o) => o.legacyId).map((o) => [o.legacyId, o]));
  const dbOrderByOrderNum = new Map(dbOrders.filter((o) => o.legacyOrderNumber).map((o) => [o.legacyOrderNumber, o]));

  const toCreateOrders = [];
  const toUpdateOrders = [];
  const skippedOrphans = [];

  for (const lo of legacyOrders) {
    const legacyId = String(lo.id);
    const legacyOrderNumber = lo.order_id || null;
    const legacyUserId = String(lo.user_id);

    if (!legacyUserMap.has(legacyUserId)) {
      skippedOrphans.push(lo);
      continue;
    }

    const userId = userIdByLegacyId.get(legacyUserId);
    if (WRITE && !userId) {
      skippedOrphans.push({ ...lo, _reason: 'user row missing in database' });
      continue;
    }

    const m = parseMetadata(lo.metadata);
    const legacyBookId = lo.book_id ? String(lo.book_id) : null;
    const status = settledStatus(lo, m);
    const oUpdatedAt = toDate(lo.updated_at);
    const oCreatedAt = toDate(lo.created_at);

    const hit = dbOrderByLegacyId.get(legacyId) || (legacyOrderNumber && dbOrderByOrderNum.get(legacyOrderNumber));

    const orderData = {
      userId: userId || 'dry-run',
      bookId: legacyBookId ? bookIdMap[legacyBookId] || null : null,
      amount: parseFloat(lo.amount) || 0,
      currency: lo.currency || 'INR',
      status,
      razorpayOrderId: m.razorpay_order_id || null,
      razorpayPaymentId: m.razorpay_payment_id || null,
      razorpaySignature: m.razorpay_signature || null,
      legacyId,
      legacyOrderNumber,
      legacyBookId,
      legacyStatus: lo.status || null,
      legacyPaymentStatus: lo.payment_status || null,
      description: lo.description || null,
      accessType: lo.access_type || null,
      validTill: toDate(lo.valid_till),
      paidAt: toDate(lo.paid_at),
      legacyData: { ...lo, metadata: m },
      createdAt: oCreatedAt || new Date(),
      updatedAt: oUpdatedAt || oCreatedAt || new Date(),
    };

    if (hit) {
      // Check if updated in the last ~45 days
      if (oUpdatedAt && oUpdatedAt >= CUTOFF_DATE) {
        toUpdateOrders.push({
          id: hit.id,
          legacyId,
          data: {
            ...orderData,
            userId: hit.userId || orderData.userId, // preserve existing user link
          },
        });
      }
    } else {
      toCreateOrders.push(orderData);
    }
  }

  log(`  to create: ${toCreateOrders.length}, to update (updated in last 45 days): ${toUpdateOrders.length}, skipped orphans: ${skippedOrphans.length}`);

  fs.writeFileSync(
    path.join(OUT_DIR, 'incremental-skipped-orphan-orders.json'),
    JSON.stringify(
      {
        note: 'Legacy orders whose user_id has no row in users.json. Skipped to preserve referential integrity.',
        count: skippedOrphans.length,
        recentCount: skippedOrphans.filter(o => toDate(o.created_at) >= CUTOFF_DATE).length,
        orders: skippedOrphans,
      },
      null,
      2,
    ),
  );

  let ordersCreated = 0;
  let ordersUpdated = 0;
  if (WRITE) {
    ordersCreated = await createInChunks('orders', prisma.order, toCreateOrders);
    for (let i = 0; i < toUpdateOrders.length; i++) {
      const o = toUpdateOrders[i];
      await prisma.order.update({ where: { id: o.id }, data: o.data });
      process.stdout.write(`\r  updating orders: ${i + 1}/${toUpdateOrders.length}   `);
    }
    process.stdout.write('\n');
    ordersUpdated = toUpdateOrders.length;
    log(`  updated ${ordersUpdated} existing orders`);
  }
  report.orders = {
    legacyTotalInExport: legacyOrders.length,
    newToCreate: toCreateOrders.length,
    created: ordersCreated,
    toUpdate: toUpdateOrders.length,
    updated: ordersUpdated,
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
    log(`  marked ${n} additional users as premium`);
    report.premiumMarked = n;
  }

  // --------------------------------------------------------- verification --
  log('\n[6/6] Verification');
  if (WRITE || VERIFY_ONLY) {
    const verification = await verify(legacyUsers, legacyOrders, bookIdMap, skippedOrphans);
    report.verification = verification;
  } else {
    log('  (skipped in dry-run mode since DB was not modified)');
  }
  report.finishedAt = new Date().toISOString();

  const reportFile = VERIFY_ONLY ? 'incremental-verification-report.json' : 'incremental-migration-report.json';
  fs.writeFileSync(path.join(OUT_DIR, reportFile), JSON.stringify(report, null, 2));
  log(`\nreport written to ${path.join(OUT_DIR, reportFile)}`);
}

async function verify(legacyUsers, legacyOrders, bookIdMap, skippedOrphans) {
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

  v.users = { legacyInExport: legacyUsers.length, migratedLegacyInDb: dbLegacyUsers, totalInDb: dbUsers };
  v.orders = {
    legacyInExport: legacyOrders.length,
    expectedInDb: legacyOrders.length - skippedOrphans.length,
    migratedLegacyInDb: dbLegacyOrders,
    totalInDb: dbOrders,
  };

  const dbUserLegacyIds = new Set(
    (await prisma.user.findMany({ where: { legacyId: { not: null } }, select: { legacyId: true } }))
      .map((u) => String(u.legacyId)),
  );
  const missingExportUsers = legacyUsers.filter((u) => !dbUserLegacyIds.has(String(u.id)));

  const dbOrderLegacyIds = new Set(
    (await prisma.order.findMany({ where: { legacyId: { not: null } }, select: { legacyId: true } }))
      .map((o) => String(o.legacyId)),
  );
  const missingExportOrders = legacyOrders.filter(
    (o) => !skippedIds.has(String(o.id)) && !dbOrderLegacyIds.has(String(o.id)),
  );

  check(
    'every legacy user in export migrated',
    missingExportUsers.length === 0,
    `${legacyUsers.length - missingExportUsers.length}/${legacyUsers.length} from export (total ${dbLegacyUsers} with legacyId in DB)`,
  );
  check(
    'every non-orphan legacy order in export migrated',
    missingExportOrders.length === 0,
    `${legacyOrders.length - skippedOrphans.length - missingExportOrders.length}/${legacyOrders.length - skippedOrphans.length} (${skippedOrphans.length} orphans safely excluded)`,
  );

  // Check duplicate users by legacyId
  const dupLegacyUsers = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM (
       SELECT "legacyId" FROM "User" WHERE "legacyId" IS NOT NULL
       GROUP BY "legacyId" HAVING COUNT(*) > 1) x`,
  );
  check('no duplicate users by legacyId', dupLegacyUsers[0].c === 0, `${dupLegacyUsers[0].c} duplicates`);

  // Check duplicate users by email
  const dupUserEmails = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM (
       SELECT lower(trim(email)) FROM "User"
       GROUP BY lower(trim(email)) HAVING COUNT(*) > 1) x`,
  );
  check('no duplicate users by email', dupUserEmails[0].c === 0, `${dupUserEmails[0].c} duplicates`);

  // Check duplicate orders by legacyId
  const dupLegacyOrders = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM (
       SELECT "legacyId" FROM "Order" WHERE "legacyId" IS NOT NULL
       GROUP BY "legacyId" HAVING COUNT(*) > 1) x`,
  );
  check('no duplicate orders by legacyId', dupLegacyOrders[0].c === 0, `${dupLegacyOrders[0].c} duplicates`);

  // Check duplicate orders by legacyOrderNumber
  const dupOrderNums = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM (
       SELECT "legacyOrderNumber" FROM "Order" WHERE "legacyOrderNumber" IS NOT NULL
       GROUP BY "legacyOrderNumber" HAVING COUNT(*) > 1) x`,
  );
  check('no duplicate orders by legacyOrderNumber', dupOrderNums[0].c === 0, `${dupOrderNums[0].c} duplicates`);

  // Book access verification for 101 and 113
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
    check(`book ${legacyBookId} access granted to paid users`, rows.length >= expectedUsers.size,
      `${rows.length} users have access (>= ${expectedUsers.size} expected from legacy)`);
  }

  // Referential integrity: every order must link to the matching user
  const misowned = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c
       FROM "Order" o JOIN "User" u ON u.id = o."userId"
      WHERE o."legacyId" IS NOT NULL
        AND (u."legacyId" IS NULL
             OR u."legacyId" <> (o."legacyData"->>'user_id'))`,
  );
  check('every order linked to correct owner', misowned[0].c === 0, `${misowned[0].c} mismatched`);

  // Money preserved
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

  v.passed = pass.length;
  v.failed = fail.length;
  v.failures = fail;
  log(`\n  ${pass.length} checks passed, ${fail.length} failed`);
  return v;
}

main()
  .catch((e) => {
    console.error('\nINCREMENTAL MIGRATION FAILED:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
