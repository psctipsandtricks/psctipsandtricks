/**
 * One-time migration: imports quizzes/questions/options exported from the old
 * (phpMyAdmin JSON export) database into this app's Supabase Postgres DB via
 * Prisma. Run once with `node scripts/migrate-legacy-quizzes.js` from apps/api.
 *
 * Source shape: phpMyAdmin's "Export to JSON" format — each file is
 * [header, database, { type: 'table', data: [...rows] }].
 *
 * Target shape: this app has no standalone Option table — a question's
 * answer options live as a `Json` array (`{ id, text }[]`) directly on the
 * Question row, with a separate `correctOptionIndex` pointing at the right
 * one. So the old Options table is folded into each Question at import time
 * instead of becoming its own table.
 *
 * Every quiz/question gets a brand-new UUID (never reusing the legacy
 * numeric ids); old_id -> new_id maps are written to
 * scripts/migration-output/ afterwards as an audit trail / rollback aid.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const QUIZZES_PATH = process.argv[2] || '/Users/antoanstin/Downloads/quizzes.json';
const QUESTIONS_PATH = process.argv[3] || '/Users/antoanstin/Downloads/questions.json';
const OPTIONS_PATH = process.argv[4] || '/Users/antoanstin/Downloads/options.json';
const OUTPUT_DIR = path.join(__dirname, 'migration-output');
const CHUNK_SIZE = 500;

const prisma = new PrismaClient();

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

function toIsoUtcString(mysqlDateTime) {
  const d = toUtcDate(mysqlDateTime);
  return d ? d.toISOString() : null;
}

async function insertInChunks(model, rows, label) {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await prisma[model].createMany({ data: chunk, skipDuplicates: true });
    console.log(`  ${label}: inserted ${Math.min(i + CHUNK_SIZE, rows.length)}/${rows.length}`);
  }
}

async function main() {
  console.log('Reading source JSON files...');
  const quizRows = loadTableRows(QUIZZES_PATH);
  const questionRows = loadTableRows(QUESTIONS_PATH);
  const optionRows = loadTableRows(OPTIONS_PATH);
  console.log(
    `  source counts -> quizzes: ${quizRows.length}, questions: ${questionRows.length}, options: ${optionRows.length}`,
  );

  const quizIdSet = new Set(quizRows.map((q) => q.id));

  // Only questions pointing at a quiz that actually exists in the export can
  // be linked anywhere — the rest (null quiz_id, or a quiz_id the export
  // never included) have no valid new-side home and are skipped, not guessed at.
  const nullQuizIdQuestions = questionRows.filter((q) => q.quiz_id == null);
  const danglingQuizIdQuestions = questionRows.filter((q) => q.quiz_id != null && !quizIdSet.has(q.quiz_id));
  const validQuestionRows = questionRows.filter((q) => q.quiz_id != null && quizIdSet.has(q.quiz_id));
  const validQuestionIdSet = new Set(validQuestionRows.map((q) => q.id));

  const skippedOptionRows = optionRows.filter((o) => !validQuestionIdSet.has(o.question_id));
  const validOptionRows = optionRows.filter((o) => validQuestionIdSet.has(o.question_id));

  console.log(
    `  skipping ${nullQuizIdQuestions.length} questions with no quiz_id and ` +
      `${danglingQuizIdQuestions.length} questions whose quiz_id has no matching quiz in the export ` +
      `(dangling quiz_ids: ${[...new Set(danglingQuizIdQuestions.map((q) => q.quiz_id))].join(', ') || 'none'})`,
  );
  console.log(`  skipping ${skippedOptionRows.length} options that belonged to a skipped question`);

  // Group options by their (valid) question, in original insertion order —
  // the old table has no explicit option ordering column, so ascending
  // numeric id (autoincrement PK) is the closest faithful proxy for it.
  const optionsByQuestion = new Map();
  for (const opt of validOptionRows) {
    if (!optionsByQuestion.has(opt.question_id)) optionsByQuestion.set(opt.question_id, []);
    optionsByQuestion.get(opt.question_id).push(opt);
  }
  for (const opts of optionsByQuestion.values()) {
    opts.sort((a, b) => Number(a.id) - Number(b.id));
  }

  // Group valid questions by their (valid) quiz, ordered by the legacy
  // sort_order so `totalMarks` and the create batches read naturally too.
  const questionsByQuiz = new Map();
  for (const q of validQuestionRows) {
    if (!questionsByQuiz.has(q.quiz_id)) questionsByQuiz.set(q.quiz_id, []);
    questionsByQuiz.get(q.quiz_id).push(q);
  }
  for (const qs of questionsByQuiz.values()) {
    qs.sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id));
  }

  const quizIdMap = {}; // old quiz id -> new uuid
  const questionIdMap = {}; // old question id -> new uuid
  let questionsWithNoCorrectOption = 0;

  const quizCreateRows = quizRows.map((q) => {
    const newId = crypto.randomUUID();
    quizIdMap[q.id] = newId;
    const questionsForQuiz = questionsByQuiz.get(q.id) || [];
    const totalMarks = questionsForQuiz.reduce((sum, question) => sum + (Number(question.points) || 1), 0);

    return {
      id: newId,
      title: q.title,
      category: 'General',
      description: '',
      isActive: false, // always Inactive on import, regardless of legacy status
      durationMinutes: Number(q.duration) || 30,
      passingMarks: Number(q.passing_score),
      releaseDate: toIsoUtcString(q.release_date),
      totalQuestions: questionsForQuiz.length,
      totalMarks: totalMarks || 100,
      createdAt: toUtcDate(q.created_at),
      updatedAt: toUtcDate(q.updated_at),
    };
  });

  const questionCreateRows = validQuestionRows.map((q) => {
    const newId = crypto.randomUUID();
    questionIdMap[q.id] = newId;

    const opts = optionsByQuestion.get(q.id) || [];
    const options = opts.map((o) => ({ id: `opt-${o.id}`, text: o.option_text }));
    let correctOptionIndex = opts.findIndex((o) => o.is_correct === '1');
    if (correctOptionIndex === -1) {
      questionsWithNoCorrectOption += 1;
      correctOptionIndex = 0;
    }

    return {
      id: newId,
      quizId: quizIdMap[q.quiz_id],
      text: q.question_text,
      options,
      correctOptionIndex,
      marks: Number(q.points) || 1,
      order: Number(q.sort_order) || 0,
      createdAt: toUtcDate(q.created_at),
      updatedAt: toUtcDate(q.updated_at),
    };
  });

  if (questionsWithNoCorrectOption > 0) {
    console.warn(
      `  WARNING: ${questionsWithNoCorrectOption} question(s) had no option marked is_correct=1 — defaulted to option index 0.`,
    );
  }

  console.log(`\nInserting ${quizCreateRows.length} quizzes...`);
  await insertInChunks('quiz', quizCreateRows, 'quizzes');

  console.log(`\nInserting ${questionCreateRows.length} questions (options embedded as JSON)...`);
  await insertInChunks('question', questionCreateRows, 'questions');

  // --- Verification ---
  const newQuizIds = Object.values(quizIdMap);
  const newQuestionIds = Object.values(questionIdMap);
  const [dbQuizCount, dbQuestionCount] = await Promise.all([
    prisma.quiz.count({ where: { id: { in: newQuizIds } } }),
    prisma.question.count({ where: { id: { in: newQuestionIds } } }),
  ]);
  const dbOptionCount = questionCreateRows.reduce((sum, q) => sum + q.options.length, 0);
  const dbOptionCountVerified = (
    await prisma.question.findMany({ where: { id: { in: newQuestionIds } }, select: { options: true } })
  ).reduce((sum, q) => sum + (Array.isArray(q.options) ? q.options.length : 0), 0);

  console.log('\n=== Verification ===');
  console.log(`Quizzes:   source total ${quizRows.length} | importable ${quizCreateRows.length} | inserted in DB ${dbQuizCount}`);
  console.log(
    `Questions: source total ${questionRows.length} | importable ${questionCreateRows.length} | inserted in DB ${dbQuestionCount} | skipped ${nullQuizIdQuestions.length + danglingQuizIdQuestions.length}`,
  );
  console.log(
    `Options:   source total ${optionRows.length} | importable ${validOptionRows.length} | embedded in DB ${dbOptionCountVerified} | skipped ${skippedOptionRows.length}`,
  );

  const quizOk = dbQuizCount === quizCreateRows.length;
  const questionOk = dbQuestionCount === questionCreateRows.length;
  const optionOk = dbOptionCountVerified === validOptionRows.length;
  console.log(
    `\nResult: ${quizOk && questionOk && optionOk ? 'PASS — all importable records were written correctly.' : 'MISMATCH — see counts above.'}`,
  );

  // --- Audit trail ---
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'quiz-id-map.json'), JSON.stringify(quizIdMap, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'question-id-map.json'), JSON.stringify(questionIdMap, null, 2));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'summary.json'),
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        source: { quizzes: quizRows.length, questions: questionRows.length, options: optionRows.length },
        imported: { quizzes: quizCreateRows.length, questions: questionCreateRows.length, options: validOptionRows.length },
        skipped: {
          questionsNullQuizId: nullQuizIdQuestions.length,
          questionsDanglingQuizId: danglingQuizIdQuestions.length,
          danglingQuizIds: [...new Set(danglingQuizIdQuestions.map((q) => q.quiz_id))],
          optionsForSkippedQuestions: skippedOptionRows.length,
        },
        questionsWithNoCorrectOption,
        dbVerified: { quizzes: dbQuizCount, questions: dbQuestionCount, options: dbOptionCountVerified },
      },
      null,
      2,
    ),
  );
  console.log(`\nAudit trail written to ${OUTPUT_DIR}/`);
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
