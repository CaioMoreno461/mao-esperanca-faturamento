import { getAuthUser } from "@/app/auth";
import { ensureFinanceSchema, getFinanceDb } from "@/db/runtime";
import { calculatePatientDebt, calculateSplit } from "@/lib/finance";
import type {
  Appointment,
  CashflowPoint,
  DashboardData,
  FinanceCase,
  Laboratory,
  LedgerEntry,
  Professional,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type RawCase = {
  id: number;
  patient_name: string;
  patient_phone: string | null;
  title: string;
  professional_id: number;
  professional_name: string;
  professional_color: string;
  budget_total_cents: number;
  status: string;
  due_date: string | null;
  created_at: string;
  received_cents: number;
  lab_cost_cents: number;
  laboratory_name: string | null;
};

type RawProfessional = {
  id: number;
  name: string;
  specialty: string;
  commission_bps: number;
  color: string;
  active: number;
};

type RawLaboratory = {
  id: number;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  active: number;
};

type ActionPayload = Record<string, unknown> & { action?: string };

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    const db = await getFinanceDb();
    await ensureFinanceSchema(db);
    return Response.json(await buildDashboard(db));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorized();
    const db = await getFinanceDb();
    await ensureFinanceSchema(db);
    const payload = (await request.json()) as ActionPayload;
    const actor = user.username;

    switch (payload.action) {
      case "createCase":
        await createCase(db, payload, actor);
        break;
      case "addPayment":
        await addPayment(db, payload, actor);
        break;
      case "addExpense":
        await addExpense(db, payload, actor);
        break;
      case "recordPayout":
        await recordPayout(db, payload, actor);
        break;
      case "createProfessional":
        await createProfessional(db, payload, actor);
        break;
      case "createLaboratory":
        await createLaboratory(db, payload, actor);
        break;
      case "importAppointments":
        await importAppointments(db, payload, actor);
        break;
      default:
        return Response.json({ error: "Ação inválida." }, { status: 400 });
    }

    return Response.json(await buildDashboard(db));
  } catch (error) {
    return routeError(error);
  }
}

async function buildDashboard(db: D1Database): Promise<DashboardData> {
  const [casesResult, professionalsResult, laboratoriesResult, appointmentsResult, paymentResult, payoutResult, expenseResult] =
    await Promise.all([
      db
        .prepare(
          `SELECT c.id, p.name AS patient_name, p.phone AS patient_phone,
                  c.title, c.professional_id, pr.name AS professional_name,
                  pr.color AS professional_color, c.budget_total_cents,
                  c.status, c.due_date, c.created_at,
                  COALESCE((SELECT SUM(pm.amount_cents) FROM payments pm WHERE pm.case_id = c.id), 0) AS received_cents,
                  COALESCE((SELECT SUM(lj.cost_cents) FROM lab_jobs lj WHERE lj.case_id = c.id), 0) AS lab_cost_cents,
                  (SELECT GROUP_CONCAT(DISTINCT l.name) FROM lab_jobs lj JOIN laboratories l ON l.id = lj.laboratory_id WHERE lj.case_id = c.id) AS laboratory_name
             FROM treatment_cases c
             JOIN patients p ON p.id = c.patient_id
             JOIN professionals pr ON pr.id = c.professional_id
            WHERE c.status <> 'cancelled'
            ORDER BY c.created_at DESC`,
        )
        .all<RawCase>(),
      db.prepare("SELECT id, name, specialty, commission_bps, color, active FROM professionals ORDER BY active DESC, name").all<RawProfessional>(),
      db.prepare("SELECT id, name, contact_name, email, phone, active FROM laboratories ORDER BY active DESC, name").all<RawLaboratory>(),
      db
        .prepare(
          `SELECT a.id, a.external_id, p.name AS patient_name, p.phone AS patient_phone,
                  COALESCE(pr.name, a.professional_name) AS professional_name,
                  pr.color AS professional_color, a.service, a.starts_at, a.status,
                  a.price_cents, a.source
             FROM appointments a
             JOIN patients p ON p.id = a.patient_id
        LEFT JOIN professionals pr ON pr.id = a.professional_id
            ORDER BY a.starts_at ASC
            LIMIT 100`,
        )
        .all<Record<string, string | number | null>>(),
      db
        .prepare(
          `SELECT pm.id, pm.case_id, pm.amount_cents, pm.method, pm.received_at,
                  p.name AS patient_name, c.title
             FROM payments pm
             JOIN treatment_cases c ON c.id = pm.case_id
             JOIN patients p ON p.id = c.patient_id
            ORDER BY pm.received_at DESC, pm.id DESC`,
        )
        .all<Record<string, string | number | null>>(),
      db
        .prepare(
          `SELECT po.id, po.recipient_type, po.professional_id, po.laboratory_id,
                  po.case_id, po.amount_cents, po.method, po.paid_at,
                  pr.name AS professional_name, l.name AS laboratory_name
             FROM payouts po
        LEFT JOIN professionals pr ON pr.id = po.professional_id
        LEFT JOIN laboratories l ON l.id = po.laboratory_id
            ORDER BY po.paid_at DESC, po.id DESC`,
        )
        .all<Record<string, string | number | null>>(),
      db
        .prepare("SELECT id, description, category, amount_cents, method, paid_at FROM expenses ORDER BY paid_at DESC, id DESC")
        .all<Record<string, string | number | null>>(),
    ]);

  const cases: FinanceCase[] = casesResult.results.map((row) => {
    const split = calculateSplit(Number(row.received_cents), Number(row.lab_cost_cents));
    return {
      id: row.id,
      patientName: row.patient_name,
      patientPhone: row.patient_phone,
      title: row.title,
      professionalId: row.professional_id,
      professionalName: row.professional_name,
      professionalColor: row.professional_color,
      budgetTotalCents: Number(row.budget_total_cents),
      receivedCents: Number(row.received_cents),
      debtCents: calculatePatientDebt(Number(row.budget_total_cents), Number(row.received_cents)),
      labCostCents: Number(row.lab_cost_cents),
      professionalShareCents: split.professionalShareCents,
      clinicShareCents: split.clinicShareCents,
      coverageWarning: !split.covered,
      status: row.status,
      dueDate: row.due_date,
      createdAt: row.created_at,
      laboratoryName: row.laboratory_name,
    };
  });

  const professionalPayouts = sumById(payoutResult.results, "professional_id");
  const laboratoryPayouts = sumById(payoutResult.results, "laboratory_id");
  const professionalGenerated = new Map<number, number>();
  for (const item of cases) {
    professionalGenerated.set(
      item.professionalId,
      (professionalGenerated.get(item.professionalId) ?? 0) + item.professionalShareCents,
    );
  }

  const professionals: Professional[] = professionalsResult.results.map((row) => {
    const generatedCents = professionalGenerated.get(row.id) ?? 0;
    return {
      id: row.id,
      name: row.name,
      specialty: row.specialty,
      commissionBps: row.commission_bps,
      color: row.color,
      active: Boolean(row.active),
      generatedCents,
      dueCents: Math.max(generatedCents - (professionalPayouts.get(row.id) ?? 0), 0),
    };
  });

  const labCosts = new Map<number, { cost: number; jobs: number }>();
  const labCostRows = await db.prepare("SELECT laboratory_id, SUM(cost_cents) AS cost, COUNT(*) AS jobs FROM lab_jobs GROUP BY laboratory_id").all<{ laboratory_id: number; cost: number; jobs: number }>();
  for (const row of labCostRows.results) labCosts.set(row.laboratory_id, { cost: Number(row.cost), jobs: Number(row.jobs) });

  const laboratories: Laboratory[] = laboratoriesResult.results.map((row) => {
    const totals = labCosts.get(row.id) ?? { cost: 0, jobs: 0 };
    return {
      id: row.id,
      name: row.name,
      contactName: row.contact_name,
      email: row.email,
      phone: row.phone,
      active: Boolean(row.active),
      dueCents: Math.max(totals.cost - (laboratoryPayouts.get(row.id) ?? 0), 0),
      jobsCount: totals.jobs,
    };
  });

  const appointments: Appointment[] = appointmentsResult.results.map((row) => ({
    id: Number(row.id),
    externalId: String(row.external_id),
    patientName: String(row.patient_name),
    patientPhone: row.patient_phone ? String(row.patient_phone) : null,
    professionalName: row.professional_name ? String(row.professional_name) : null,
    professionalColor: row.professional_color ? String(row.professional_color) : null,
    service: String(row.service),
    startsAt: String(row.starts_at),
    status: String(row.status),
    priceCents: Number(row.price_cents),
    source: String(row.source),
  }));

  const ledger = buildLedger(paymentResult.results, payoutResult.results, expenseResult.results);
  const receivedCents = cases.reduce((sum, item) => sum + item.receivedCents, 0);
  const expensesCents = expenseResult.results.reduce((sum, row) => sum + Number(row.amount_cents), 0);
  const payoutsCents = payoutResult.results.reduce((sum, row) => sum + Number(row.amount_cents), 0);

  return {
    generatedAt: new Date().toISOString(),
    demoMode: true,
    metrics: {
      receivedCents,
      clinicShareCents: cases.reduce((sum, item) => sum + item.clinicShareCents, 0),
      professionalDueCents: professionals.reduce((sum, item) => sum + item.dueCents, 0),
      laboratoryDueCents: laboratories.reduce((sum, item) => sum + item.dueCents, 0),
      patientDebtCents: cases.reduce((sum, item) => sum + item.debtCents, 0),
      cashBalanceCents: receivedCents - expensesCents - payoutsCents,
      expensesCents,
    },
    cases,
    professionals,
    laboratories,
    appointments,
    ledger,
    cashflow: buildCashflow(ledger),
    integration: {
      provider: "MinhaAgenda",
      status: "authorization_required",
      lastSyncAt: null,
      importedAppointments: appointments.filter((item) => item.source === "csv").length,
    },
  };
}

function sumById(rows: Record<string, string | number | null>[], key: string) {
  const totals = new Map<number, number>();
  for (const row of rows) {
    const id = Number(row[key]);
    if (!id) continue;
    totals.set(id, (totals.get(id) ?? 0) + Number(row.amount_cents));
  }
  return totals;
}

function buildLedger(
  payments: Record<string, string | number | null>[],
  payouts: Record<string, string | number | null>[],
  expenses: Record<string, string | number | null>[],
): LedgerEntry[] {
  const entries: LedgerEntry[] = [
    ...payments.map((row) => ({
      id: `payment-${row.id}`,
      direction: "in" as const,
      kind: "payment" as const,
      description: String(row.title),
      counterpart: String(row.patient_name),
      amountCents: Number(row.amount_cents),
      date: String(row.received_at),
      method: String(row.method),
    })),
    ...payouts.map((row) => ({
      id: `payout-${row.id}`,
      direction: "out" as const,
      kind: row.recipient_type === "professional" ? ("professional" as const) : ("laboratory" as const),
      description: row.recipient_type === "professional" ? "Pagamento a profissional" : "Pagamento a laboratório",
      counterpart: String(row.professional_name ?? row.laboratory_name ?? "—"),
      amountCents: Number(row.amount_cents),
      date: String(row.paid_at),
      method: String(row.method),
    })),
    ...expenses.map((row) => ({
      id: `expense-${row.id}`,
      direction: "out" as const,
      kind: "expense" as const,
      description: String(row.description),
      counterpart: String(row.category),
      amountCents: Number(row.amount_cents),
      date: String(row.paid_at),
      method: String(row.method),
    })),
  ];
  return entries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
}

function buildCashflow(ledger: LedgerEntry[]): CashflowPoint[] {
  const points: CashflowPoint[] = [];
  const now = new Date();
  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthEntries = ledger.filter((entry) => entry.date.startsWith(key));
    points.push({
      month: new Intl.DateTimeFormat("pt-PT", { month: "short" }).format(date).replace(".", ""),
      incomeCents: monthEntries.filter((entry) => entry.direction === "in").reduce((sum, entry) => sum + entry.amountCents, 0),
      outflowCents: monthEntries.filter((entry) => entry.direction === "out").reduce((sum, entry) => sum + entry.amountCents, 0),
    });
  }
  return points;
}

async function createCase(db: D1Database, payload: ActionPayload, actor: string | null) {
  const patientName = requiredText(payload.patientName, "Nome do paciente");
  const professionalId = requiredPositiveInt(payload.professionalId, "Profissional");
  const title = requiredText(payload.title, "Tratamento");
  const budgetTotalCents = requiredMoney(payload.budgetTotalCents, "Valor do orçamento");
  const receivedCents = optionalMoney(payload.receivedCents);
  const labCostCents = optionalMoney(payload.labCostCents);
  const laboratoryId = payload.laboratoryId ? requiredPositiveInt(payload.laboratoryId, "Laboratório") : null;
  if (labCostCents > 0 && !laboratoryId) throw new Error("Selecione o laboratório para registar o custo protético.");

  const now = new Date().toISOString();
  const phone = optionalText(payload.patientPhone);
  let patient = await db
    .prepare("SELECT id FROM patients WHERE lower(name) = lower(?) AND COALESCE(phone, '') = COALESCE(?, '') LIMIT 1")
    .bind(patientName, phone)
    .first<{ id: number }>();
  if (!patient) {
    const result = await db
      .prepare("INSERT INTO patients (name, phone, email, created_at) VALUES (?, ?, ?, ?)")
      .bind(patientName, phone, optionalText(payload.patientEmail), now)
      .run();
    patient = { id: Number(result.meta.last_row_id) };
  }

  const caseResult = await db
    .prepare("INSERT INTO treatment_cases (patient_id, professional_id, title, budget_total_cents, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(patient.id, professionalId, title, budgetTotalCents, "open", optionalText(payload.dueDate), now)
    .run();
  const caseId = Number(caseResult.meta.last_row_id);

  if (receivedCents > 0) {
    await db
      .prepare("INSERT INTO payments (case_id, amount_cents, method, received_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(caseId, receivedCents, optionalText(payload.method) ?? "multibanco", dateOnly(payload.receivedAt), "Pagamento inicial", now)
      .run();
  }
  if (labCostCents > 0 && laboratoryId) {
    await db
      .prepare("INSERT INTO lab_jobs (case_id, laboratory_id, description, cost_cents, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(caseId, laboratoryId, optionalText(payload.labDescription) ?? title, labCostCents, "pending", optionalText(payload.labDueDate), now)
      .run();
  }
  await audit(db, "create", "treatment_case", caseId, actor, { budgetTotalCents, receivedCents, hasLab: labCostCents > 0 });
}

async function addPayment(db: D1Database, payload: ActionPayload, actor: string | null) {
  const caseId = requiredPositiveInt(payload.caseId, "Orçamento");
  const amountCents = requiredMoney(payload.amountCents, "Valor recebido");
  const now = new Date().toISOString();
  const result = await db
    .prepare("INSERT INTO payments (case_id, amount_cents, method, received_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(caseId, amountCents, requiredText(payload.method, "Método"), dateOnly(payload.date), optionalText(payload.note), now)
    .run();
  await audit(db, "create", "payment", Number(result.meta.last_row_id), actor, { caseId, amountCents });
}

async function addExpense(db: D1Database, payload: ActionPayload, actor: string | null) {
  const amountCents = requiredMoney(payload.amountCents, "Valor da despesa");
  const now = new Date().toISOString();
  const result = await db
    .prepare("INSERT INTO expenses (description, category, amount_cents, method, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(requiredText(payload.description, "Descrição"), requiredText(payload.category, "Categoria"), amountCents, requiredText(payload.method, "Método"), dateOnly(payload.date), now)
    .run();
  await audit(db, "create", "expense", Number(result.meta.last_row_id), actor, { amountCents });
}

async function recordPayout(db: D1Database, payload: ActionPayload, actor: string | null) {
  const recipientType = requiredText(payload.recipientType, "Tipo de destinatário");
  if (!['professional', 'laboratory'].includes(recipientType)) throw new Error("Destinatário inválido.");
  const recipientId = requiredPositiveInt(payload.recipientId, "Destinatário");
  const amountCents = requiredMoney(payload.amountCents, "Valor pago");
  const now = new Date().toISOString();
  const professionalId = recipientType === "professional" ? recipientId : null;
  const laboratoryId = recipientType === "laboratory" ? recipientId : null;
  const result = await db
    .prepare("INSERT INTO payouts (recipient_type, professional_id, laboratory_id, case_id, amount_cents, method, paid_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(recipientType, professionalId, laboratoryId, payload.caseId ? Number(payload.caseId) : null, amountCents, requiredText(payload.method, "Método"), dateOnly(payload.date), optionalText(payload.note), now)
    .run();
  await audit(db, "create", "payout", Number(result.meta.last_row_id), actor, { recipientType, recipientId, amountCents });
}

async function createProfessional(db: D1Database, payload: ActionPayload, actor: string | null) {
  const now = new Date().toISOString();
  const result = await db
    .prepare("INSERT INTO professionals (name, specialty, commission_bps, color, active, created_at) VALUES (?, ?, 5000, ?, 1, ?)")
    .bind(requiredText(payload.name, "Nome"), requiredText(payload.specialty, "Especialidade"), optionalText(payload.color) ?? "#16796f", now)
    .run();
  await audit(db, "create", "professional", Number(result.meta.last_row_id), actor, { commission: "50%" });
}

async function createLaboratory(db: D1Database, payload: ActionPayload, actor: string | null) {
  const now = new Date().toISOString();
  const result = await db
    .prepare("INSERT INTO laboratories (name, contact_name, email, phone, active, created_at) VALUES (?, ?, ?, ?, 1, ?)")
    .bind(requiredText(payload.name, "Nome"), optionalText(payload.contactName), optionalText(payload.email), optionalText(payload.phone), now)
    .run();
  await audit(db, "create", "laboratory", Number(result.meta.last_row_id), actor, {});
}

async function importAppointments(db: D1Database, payload: ActionPayload, actor: string | null) {
  if (!Array.isArray(payload.records) || payload.records.length === 0) throw new Error("O ficheiro não contém registos válidos.");
  if (payload.records.length > 500) throw new Error("Importe no máximo 500 agendamentos por vez.");
  let imported = 0;
  for (const raw of payload.records) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const patientName = requiredText(record.patientName, "Paciente");
    const service = requiredText(record.service, "Serviço");
    const startsAt = requiredText(record.startsAt, "Data e hora");
    if (Number.isNaN(Date.parse(startsAt))) throw new Error(`Data inválida no agendamento de ${patientName}.`);
    const now = new Date().toISOString();
    const phone = optionalText(record.patientPhone);
    let patient = await db.prepare("SELECT id FROM patients WHERE lower(name) = lower(?) AND COALESCE(phone, '') = COALESCE(?, '') LIMIT 1").bind(patientName, phone).first<{ id: number }>();
    if (!patient) {
      const inserted = await db.prepare("INSERT INTO patients (name, phone, email, created_at) VALUES (?, ?, ?, ?)").bind(patientName, phone, optionalText(record.patientEmail), now).run();
      patient = { id: Number(inserted.meta.last_row_id) };
    }
    const professionalName = optionalText(record.professionalName);
    const professional = professionalName
      ? await db.prepare("SELECT id FROM professionals WHERE lower(name) = lower(?) LIMIT 1").bind(professionalName).first<{ id: number }>()
      : null;
    const externalId = optionalText(record.externalId) ?? `csv-${startsAt}-${patientName}-${service}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await db
      .prepare(
        `INSERT INTO appointments (external_id, patient_id, professional_id, professional_name, service, starts_at, status, price_cents, source, synced_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'csv', ?, ?)
         ON CONFLICT(external_id) DO UPDATE SET patient_id = excluded.patient_id, professional_id = excluded.professional_id,
           professional_name = excluded.professional_name, service = excluded.service, starts_at = excluded.starts_at,
           status = excluded.status, price_cents = excluded.price_cents, synced_at = excluded.synced_at`,
      )
      .bind(externalId, patient.id, professional?.id ?? null, professionalName, service, new Date(startsAt).toISOString(), optionalText(record.status) ?? "pending", optionalMoney(record.priceCents), now, now)
      .run();
    imported += 1;
  }
  await audit(db, "import", "appointment", null, actor, { imported, source: "csv" });
}

async function audit(db: D1Database, action: string, entity: string, entityId: number | null, actor: string | null, details: Record<string, unknown>) {
  await db.prepare("INSERT INTO audit_logs (action, entity, entity_id, actor_email, details, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(action, entity, entityId, actor, JSON.stringify(details), new Date().toISOString()).run();
}

function requiredText(value: unknown, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new Error(`${label} é obrigatório.`);
  return text;
}

function optionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function requiredPositiveInt(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} é obrigatório.`);
  return parsed;
}

function optionalMoney(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Valor monetário inválido.");
  return parsed;
}

function requiredMoney(value: unknown, label: string) {
  const parsed = optionalMoney(value);
  if (parsed <= 0) throw new Error(`${label} deve ser superior a zero.`);
  return parsed;
}

function dateOnly(value: unknown) {
  const text = optionalText(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 10);
}

function unauthorized() {
  return Response.json({ error: "Autenticação necessária." }, { status: 401 });
}

function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
  const lower = message.toLowerCase();
  const status = lower.includes("obrigat") || lower.includes("inválid") || lower.includes("superior") ? 400 : 500;
  return Response.json({ error: message }, { status });
}
