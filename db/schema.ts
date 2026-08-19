import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const professionals = sqliteTable("professionals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  commissionBps: integer("commission_bps").notNull().default(5000),
  color: text("color").notNull().default("#16796f"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const laboratories = sqliteTable("laboratories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const patients = sqliteTable(
  "patients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    externalId: text("external_id"),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("patients_external_id_idx").on(table.externalId)],
);

export const treatmentCases = sqliteTable("treatment_cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: integer("patient_id").notNull(),
  professionalId: integer("professional_id").notNull(),
  title: text("title").notNull(),
  budgetTotalCents: integer("budget_total_cents").notNull(),
  status: text("status").notNull().default("open"),
  dueDate: text("due_date"),
  externalAppointmentId: text("external_appointment_id"),
  createdAt: text("created_at").notNull(),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  method: text("method").notNull(),
  receivedAt: text("received_at").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const labJobs = sqliteTable("lab_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  laboratoryId: integer("laboratory_id").notNull(),
  description: text("description").notNull(),
  costCents: integer("cost_cents").notNull(),
  status: text("status").notNull().default("pending"),
  dueDate: text("due_date"),
  createdAt: text("created_at").notNull(),
});

export const payouts = sqliteTable("payouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipientType: text("recipient_type").notNull(),
  professionalId: integer("professional_id"),
  laboratoryId: integer("laboratory_id"),
  caseId: integer("case_id"),
  amountCents: integer("amount_cents").notNull(),
  method: text("method").notNull(),
  paidAt: text("paid_at").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  description: text("description").notNull(),
  category: text("category").notNull(),
  amountCents: integer("amount_cents").notNull(),
  method: text("method").notNull(),
  paidAt: text("paid_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const appointments = sqliteTable(
  "appointments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    externalId: text("external_id").notNull(),
    patientId: integer("patient_id").notNull(),
    professionalId: integer("professional_id"),
    professionalName: text("professional_name"),
    service: text("service").notNull(),
    startsAt: text("starts_at").notNull(),
    status: text("status").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    source: text("source").notNull().default("manual"),
    syncedAt: text("synced_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("appointments_external_id_idx").on(table.externalId)],
);

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  actorEmail: text("actor_email"),
  details: text("details"),
  createdAt: text("created_at").notNull(),
});
