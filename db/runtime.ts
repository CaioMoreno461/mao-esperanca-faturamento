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
  await seedDemoData(db);
}

async function seedDemoData(db: D1Database) {
  const existing = await db
    .prepare("SELECT COUNT(*) AS total FROM professionals")
    .first<{ total: number }>();
  if ((existing?.total ?? 0) > 0) return;

  const now = "2026-08-19T10:00:00.000Z";
  const statements = [
    db
      .prepare(
        "INSERT INTO professionals (id, name, specialty, commission_bps, color, active, created_at) VALUES (?, ?, ?, 5000, ?, 1, ?)",
      )
      .bind(1, "Dra. Sofia Almeida", "Implantologia", "#0f766e", now),
    db
      .prepare(
        "INSERT INTO professionals (id, name, specialty, commission_bps, color, active, created_at) VALUES (?, ?, ?, 5000, ?, 1, ?)",
      )
      .bind(2, "Dr. Miguel Santos", "Medicina dentária geral", "#3157a4", now),
    db
      .prepare(
        "INSERT INTO professionals (id, name, specialty, commission_bps, color, active, created_at) VALUES (?, ?, ?, 5000, ?, 1, ?)",
      )
      .bind(3, "Dra. Leonor Costa", "Ortodontia", "#9a5b18", now),
    db
      .prepare(
        "INSERT INTO laboratories (id, name, contact_name, email, phone, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
      )
      .bind(1, "Algarve Dental Lab", "Nuno Carvalho", "geral@algarvedentallab.pt", "+351 289 000 110", now),
    db
      .prepare(
        "INSERT INTO laboratories (id, name, contact_name, email, phone, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
      )
      .bind(2, "Cerâmica Sul", "Inês Duarte", "laboratorio@ceramicasul.pt", "+351 289 000 220", now),
    db
      .prepare("INSERT INTO patients (id, external_id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(1, "demo-p-001", "Joana Ribeiro", "+351 910 000 101", "joana.exemplo@invalid.test", now),
    db
      .prepare("INSERT INTO patients (id, external_id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(2, "demo-p-002", "Rui Costa", "+351 910 000 102", "rui.exemplo@invalid.test", now),
    db
      .prepare("INSERT INTO patients (id, external_id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(3, "demo-p-003", "Marta Nunes", "+351 910 000 103", "marta.exemplo@invalid.test", now),
    db
      .prepare("INSERT INTO patients (id, external_id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(4, "demo-p-004", "Diogo Martins", "+351 910 000 104", "diogo.exemplo@invalid.test", now),
    db
      .prepare("INSERT INTO treatment_cases (id, patient_id, professional_id, title, budget_total_cents, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(1, 1, 1, "Carga imediata — arcada superior", 320000, "completed", "2026-08-15", "2026-05-11T09:00:00.000Z"),
    db
      .prepare("INSERT INTO treatment_cases (id, patient_id, professional_id, title, budget_total_cents, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(2, 2, 2, "Tratamento restaurador", 120000, "in_progress", "2026-09-10", "2026-06-03T11:30:00.000Z"),
    db
      .prepare("INSERT INTO treatment_cases (id, patient_id, professional_id, title, budget_total_cents, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(3, 3, 1, "Prótese fixa sobre implantes", 280000, "in_progress", "2026-09-30", "2026-07-22T15:00:00.000Z"),
    db
      .prepare("INSERT INTO treatment_cases (id, patient_id, professional_id, title, budget_total_cents, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(4, 4, 3, "Avaliação e aparelho ortodôntico", 18000, "completed", "2026-08-19", "2026-08-10T14:00:00.000Z"),
    db
      .prepare("INSERT INTO payments (case_id, amount_cents, method, received_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(1, 120000, "transferência", "2026-05-11", "Entrada", "2026-05-11T09:10:00.000Z"),
    db
      .prepare("INSERT INTO payments (case_id, amount_cents, method, received_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(1, 200000, "cartão", "2026-07-18", "Liquidação", "2026-07-18T16:10:00.000Z"),
    db
      .prepare("INSERT INTO payments (case_id, amount_cents, method, received_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(2, 90000, "multibanco", "2026-06-03", "Pagamento parcial", "2026-06-03T11:40:00.000Z"),
    db
      .prepare("INSERT INTO payments (case_id, amount_cents, method, received_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(3, 150000, "transferência", "2026-08-02", "Primeira fase", "2026-08-02T12:00:00.000Z"),
    db
      .prepare("INSERT INTO payments (case_id, amount_cents, method, received_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(4, 18000, "numerário", "2026-08-10", "Pago", "2026-08-10T14:10:00.000Z"),
    db
      .prepare("INSERT INTO lab_jobs (case_id, laboratory_id, description, cost_cents, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(1, 1, "Estrutura provisória e definitiva", 60000, "delivered", "2026-07-12", "2026-05-12T10:00:00.000Z"),
    db
      .prepare("INSERT INTO lab_jobs (case_id, laboratory_id, description, cost_cents, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(3, 2, "Cerâmica e componentes protéticos", 42000, "in_production", "2026-09-12", "2026-08-03T10:00:00.000Z"),
    db
      .prepare("INSERT INTO payouts (recipient_type, professional_id, laboratory_id, case_id, amount_cents, method, paid_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("laboratory", null, 1, 1, 60000, "transferência", "2026-07-25", "Lab liquidado", "2026-07-25T10:00:00.000Z"),
    db
      .prepare("INSERT INTO payouts (recipient_type, professional_id, laboratory_id, case_id, amount_cents, method, paid_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("professional", 1, null, 1, 130000, "transferência", "2026-07-26", "Caso liquidado", "2026-07-26T10:00:00.000Z"),
    db
      .prepare("INSERT INTO payouts (recipient_type, professional_id, laboratory_id, case_id, amount_cents, method, paid_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("professional", 2, null, 2, 30000, "transferência", "2026-07-30", "Adiantamento", "2026-07-30T10:00:00.000Z"),
    db
      .prepare("INSERT INTO expenses (description, category, amount_cents, method, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind("Materiais clínicos", "materiais", 28500, "cartão", "2026-06-12", "2026-06-12T12:00:00.000Z"),
    db
      .prepare("INSERT INTO expenses (description, category, amount_cents, method, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind("Renda e serviços", "estrutura", 45000, "débito", "2026-08-01", "2026-08-01T08:00:00.000Z"),
    db
      .prepare("INSERT INTO appointments (external_id, patient_id, professional_id, professional_name, service, starts_at, status, price_cents, source, synced_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("demo-a-001", 1, 1, "Dra. Sofia Almeida", "Revisão de implantes", "2026-08-20T09:30:00+01:00", "confirmed", 7000, "demo", null, now),
    db
      .prepare("INSERT INTO appointments (external_id, patient_id, professional_id, professional_name, service, starts_at, status, price_cents, source, synced_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("demo-a-002", 2, 2, "Dr. Miguel Santos", "Restauração", "2026-08-20T11:00:00+01:00", "confirmed", 9500, "demo", null, now),
    db
      .prepare("INSERT INTO appointments (external_id, patient_id, professional_id, professional_name, service, starts_at, status, price_cents, source, synced_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("demo-a-003", 3, 1, "Dra. Sofia Almeida", "Prova de estrutura", "2026-08-21T15:00:00+01:00", "pending", 0, "demo", null, now),
    db
      .prepare("INSERT INTO appointments (external_id, patient_id, professional_id, professional_name, service, starts_at, status, price_cents, source, synced_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("demo-a-004", 4, 3, "Dra. Leonor Costa", "Consulta de ortodontia", "2026-08-22T10:15:00+01:00", "confirmed", 5000, "demo", null, now),
  ];

  await db.batch(statements);
}
