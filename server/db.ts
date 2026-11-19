import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import type {
  BenchmarkRunSummary,
  DocumentReport,
  HumanReviewDecision,
  WorkspaceUser,
} from '../src/types.ts';

const DB_PATH = path.resolve(process.cwd(), '.citeverify.db');

let dbInstance: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      report_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_display_name TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      is_sample_demo INTEGER NOT NULL DEFAULT 0,
      uploaded_at TEXT NOT NULL,
      total_claims INTEGER NOT NULL DEFAULT 0,
      verified_sources INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS claims (
      id TEXT NOT NULL,
      report_id TEXT NOT NULL,
      claim_text TEXT NOT NULL,
      matched_citation TEXT NOT NULL,
      verdict TEXT NOT NULL,
      nli_label TEXT NOT NULL,
      numerical_status TEXT NOT NULL,
      context_trap_detected INTEGER NOT NULL DEFAULT 0,
      human_decision TEXT NOT NULL DEFAULT 'Pending',
      reviewer_comments TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (report_id, id),
      FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS review_audit_log (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      claim_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      decision TEXT NOT NULL,
      comment TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS benchmark_runs (
      run_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ran_at TEXT NOT NULL,
      total_items INTEGER NOT NULL,
      overall_accuracy REAL NOT NULL,
      macro_f1 REAL NOT NULL,
      payload_json TEXT NOT NULL
    );
  `);

  // Seed default workspace researcher profiles if empty
  const existingUsers = db
    .prepare('SELECT COUNT(*) as cnt FROM users')
    .get() as { cnt: number };
  if (existingUsers.cnt === 0) {
    const now = new Date().toISOString();
    const insertUser = db.prepare(
      'INSERT INTO users (id, display_name, role, created_at) VALUES (?, ?, ?, ?)'
    );
    insertUser.run('usr-elena', 'Dr. Elena Vance', 'Lead Integrity Auditor', now);
    insertUser.run('usr-marcus', 'Prof. Marcus Chen', 'Clinical Peer Reviewer', now);
    insertUser.run('usr-priya', 'Dr. Priya Nair', 'Statistical Reviewer', now);
  }

  dbInstance = db;
  return db;
}

export function listUsers(): WorkspaceUser[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, display_name, role FROM users ORDER BY created_at ASC')
    .all() as Array<{ id: string; display_name: string; role: string }>;
  return rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    role: r.role,
  }));
}

export function ensureUser(
  id: string,
  displayName?: string,
  role = 'Research Reviewer'
): WorkspaceUser {
  const db = getDb();
  const cleanId = (id || 'usr-elena').trim();
  const existing = db
    .prepare('SELECT id, display_name, role FROM users WHERE id = ?')
    .get(cleanId) as
    | { id: string; display_name: string; role: string }
    | undefined;
  if (existing) {
    return {
      id: existing.id,
      displayName: existing.display_name,
      role: existing.role,
    };
  }
  const name = (displayName || cleanId).trim();
  db.prepare(
    'INSERT INTO users (id, display_name, role, created_at) VALUES (?, ?, ?, ?)'
  ).run(cleanId, name, role, new Date().toISOString());
  return { id: cleanId, displayName: name, role };
}

export function saveReportToDb(report: DocumentReport): void {
  const db = getDb();
  ensureUser(report.userId, report.userDisplayName);

  db.prepare(
    `INSERT INTO reports (
      report_id, user_id, user_display_name, filename, file_type,
      is_sample_demo, uploaded_at, total_claims, verified_sources, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(report_id) DO UPDATE SET
      payload_json = excluded.payload_json,
      total_claims = excluded.total_claims,
      verified_sources = excluded.verified_sources`
  ).run(
    report.reportId,
    report.userId,
    report.userDisplayName,
    report.filename,
    report.fileType,
    report.isSampleDemo ? 1 : 0,
    report.uploadedAt,
    report.summaryStats.totalClaims,
    report.summaryStats.verifiedSources,
    JSON.stringify(report)
  );

  const upsertClaim = db.prepare(
    `INSERT INTO claims (
      id, report_id, claim_text, matched_citation, verdict, nli_label,
      numerical_status, context_trap_detected, human_decision, reviewer_comments
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(report_id, id) DO UPDATE SET
      verdict = excluded.verdict,
      nli_label = excluded.nli_label,
      numerical_status = excluded.numerical_status,
      context_trap_detected = excluded.context_trap_detected,
      human_decision = excluded.human_decision,
      reviewer_comments = excluded.reviewer_comments`
  );

  for (const c of report.claims) {
    upsertClaim.run(
      c.id,
      report.reportId,
      c.claimText,
      c.matchedCitation,
      c.verdict,
      c.nli.label,
      c.numericalCheck.status,
      c.contextTrap.detected ? 1 : 0,
      c.humanReview.decision,
      c.humanReview.comments || ''
    );
  }
}

export function listReportsFromDb(userId?: string): DocumentReport[] {
  const db = getDb();
  const rows = userId && userId !== 'all'
    ? (db
        .prepare(
          'SELECT payload_json FROM reports WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT 50'
        )
        .all(userId) as Array<{ payload_json: string }>)
    : (db
        .prepare(
          'SELECT payload_json FROM reports ORDER BY uploaded_at DESC LIMIT 50'
        )
        .all() as Array<{ payload_json: string }>);

  const out: DocumentReport[] = [];
  for (const row of rows) {
    try {
      out.push(JSON.parse(row.payload_json));
    } catch {
      // Skip malformed rows if any
    }
  }
  return out;
}

export function getReportFromDb(reportId: string): DocumentReport | undefined {
  const db = getDb();
  const row = db
    .prepare('SELECT payload_json FROM reports WHERE report_id = ?')
    .get(reportId) as { payload_json: string } | undefined;
  if (!row) return undefined;
  return JSON.parse(row.payload_json) as DocumentReport;
}

export function recordClaimReviewInDb(params: {
  reportId: string;
  claimId: string;
  userId: string;
  reviewerName: string;
  decision: HumanReviewDecision;
  comments: string;
}): DocumentReport | undefined {
  const report = getReportFromDb(params.reportId);
  if (!report) return undefined;

  const claim = report.claims.find((c) => c.id === params.claimId);
  if (!claim) return undefined;

  const timestamp = new Date().toISOString();
  const entryId = `REV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const action =
    params.decision !== claim.humanReview.decision
      ? `Status set to ${params.decision}`
      : 'Reviewer comment updated';

  claim.humanReview = {
    decision: params.decision,
    comments: params.comments,
    lastUpdated: timestamp,
    history: [
      {
        id: entryId,
        timestamp,
        action,
        decision: params.decision,
        comment: params.comments || undefined,
        reviewer: params.reviewerName,
      },
      ...claim.humanReview.history,
    ],
  };

  const db = getDb();
  ensureUser(params.userId, params.reviewerName);
  db.prepare(
    `INSERT INTO review_audit_log (
      id, report_id, claim_id, user_id, reviewer_name, decision, comment, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entryId,
    params.reportId,
    params.claimId,
    params.userId,
    params.reviewerName,
    params.decision,
    params.comments || null,
    timestamp
  );

  saveReportToDb(report);
  return report;
}

export function saveBenchmarkRunToDb(run: BenchmarkRunSummary): void {
  const db = getDb();
  ensureUser(run.userId);
  db.prepare(
    `INSERT INTO benchmark_runs (
      run_id, user_id, ran_at, total_items, overall_accuracy, macro_f1, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    run.runId,
    run.userId,
    run.ranAt,
    run.totalItems,
    run.overallAccuracy,
    run.macroF1,
    JSON.stringify(run)
  );
}

export function listBenchmarkRunsFromDb(): BenchmarkRunSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT payload_json FROM benchmark_runs ORDER BY ran_at DESC LIMIT 15'
    )
    .all() as Array<{ payload_json: string }>;
  const out: BenchmarkRunSummary[] = [];
  for (const r of rows) {
    try {
      out.push(JSON.parse(r.payload_json));
    } catch {
      // Ignore parse error
    }
  }
  return out;
}
