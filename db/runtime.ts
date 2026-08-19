const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS professionals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    commission_bps INTEGER NOT NULL DEFAULT 5000,
    color TEXT NOT NULL DEFAULT '#16796f',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS laboratories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS treatment_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    professional_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    budget_total_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    due_date TEXT,
    external_appointment_id TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    method TEXT NOT NULL,
    received_at TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS lab_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    laboratory_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    cost_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    due_date TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_type TEXT NOT NULL,
    professional_id INTEGER,
    laboratory_id INTEGER,
    case_id INTEGER,
    amount_cents INTEGER NOT NULL,
    method TEXT NOT NULL,
    paid_at TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    method TEXT NOT NULL,
    paid_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT NOT NULL UNIQUE,
    patient_id INTEGER NOT NULL,
    professional_id INTEGER,
    professional_name TEXT,
    service TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    status TEXT NOT NULL,
    price_cents INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'manual',
    synced_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    actor_email TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cases_patient_idx ON treatment_cases(patient_id)`,
  `CREATE INDEX IF NOT EXISTS cases_professional_idx ON treatment_cases(professional_id)`,
  `CREATE INDEX IF NOT EXISTS payments_case_idx ON payments(case_id)`,
  `CREATE INDEX IF NOT EXISTS lab_jobs_case_idx ON lab_jobs(case_id)`,
  `CREATE INDEX IF NOT EXISTS appointments_starts_at_idx ON appointments(starts_at)`,
];

export async function getFinanceDb(): Promise<D1Database> {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error("A base de dados financeira não está disponível.");
  }
  return env.DB;
}

export async function ensureFinanceSchema(db: D1Database) {
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  await removeDemoData(db);
}
async function removeDemoData(db: D1Database) {
  const demoCaseIds =
    "SELECT c.id FROM treatment_cases c JOIN patients p ON p.id = c.patient_id WHERE p.external_id LIKE 'demo-p-%'";
  await db.batch([
    db.prepare(`DELETE FROM payments WHERE case_id IN (${demoCaseIds})`),
    db.prepare(`DELETE FROM lab_jobs WHERE case_id IN (${demoCaseIds})`),
    db.prepare(`DELETE FROM payouts WHERE case_id IN (${demoCaseIds})`),
    db.prepare(`DELETE FROM treatment_cases WHERE id IN (${demoCaseIds})`),
    db.prepare("DELETE FROM appointments WHERE source = 'demo' OR external_id LIKE 'demo-a-%'"),
    db.prepare("DELETE FROM expenses WHERE created_at = '2026-06-12T12:00:00.000Z' AND description = 'Materiais clínicos'"),
    db.prepare("DELETE FROM expenses WHERE created_at = '2026-08-01T08:00:00.000Z' AND description = 'Renda e serviços'"),
    db.prepare("DELETE FROM patients WHERE external_id LIKE 'demo-p-%'"),
    db.prepare("DELETE FROM professionals WHERE created_at = '2026-08-19T10:00:00.000Z' AND id NOT IN (SELECT professional_id FROM treatment_cases) AND id NOT IN (SELECT professional_id FROM appointments WHERE professional_id IS NOT NULL)"),
    db.prepare("DELETE FROM laboratories WHERE created_at = '2026-08-19T10:00:00.000Z' AND id NOT IN (SELECT laboratory_id FROM lab_jobs)"),
  ]);
}


