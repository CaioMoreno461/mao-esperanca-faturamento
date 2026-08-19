export type Professional = {
  id: number;
  name: string;
  specialty: string;
  commissionBps: number;
  color: string;
  active: boolean;
  dueCents: number;
  generatedCents: number;
};

export type Laboratory = {
  id: number;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  dueCents: number;
  jobsCount: number;
};

export type FinanceCase = {
  id: number;
  patientName: string;
  patientPhone: string | null;
  title: string;
  professionalId: number;
  professionalName: string;
  professionalColor: string;
  budgetTotalCents: number;
  receivedCents: number;
  debtCents: number;
  labCostCents: number;
  professionalShareCents: number;
  clinicShareCents: number;
  coverageWarning: boolean;
  status: string;
  dueDate: string | null;
  createdAt: string;
  laboratoryName: string | null;
};

export type Appointment = {
  id: number;
  externalId: string;
  patientName: string;
  patientPhone: string | null;
  professionalName: string | null;
  professionalColor: string | null;
  service: string;
  startsAt: string;
  status: string;
  priceCents: number;
  source: string;
};

export type LedgerEntry = {
  id: string;
  direction: "in" | "out";
  kind: "payment" | "professional" | "laboratory" | "expense";
  description: string;
  counterpart: string;
  amountCents: number;
  date: string;
  method: string;
};

export type CashflowPoint = {
  month: string;
  incomeCents: number;
  outflowCents: number;
};

export type DashboardMetrics = {
  receivedCents: number;
  clinicShareCents: number;
  professionalDueCents: number;
  laboratoryDueCents: number;
  patientDebtCents: number;
  cashBalanceCents: number;
  expensesCents: number;
};

export type DashboardData = {
  generatedAt: string;
  demoMode: boolean;
  metrics: DashboardMetrics;
  cases: FinanceCase[];
  professionals: Professional[];
  laboratories: Laboratory[];
  appointments: Appointment[];
  ledger: LedgerEntry[];
  cashflow: CashflowPoint[];
  integration: {
    provider: string;
    status: "authorization_required" | "configured" | "error";
    lastSyncAt: string | null;
    importedAppointments: number;
  };
};
