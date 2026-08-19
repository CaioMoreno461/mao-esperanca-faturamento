export type SplitResult = {
  receivedCents: number;
  prostheticCostCents: number;
  distributableCents: number;
  professionalShareCents: number;
  clinicShareCents: number;
  covered: boolean;
};

/**
 * Regra da clínica: primeiro retira-se o custo protético e só depois o saldo é
 * dividido em 50/50. Quando existe um cêntimo indivisível, ele fica na clínica
 * para que a soma permaneça exata e auditável.
 */
export function calculateSplit(
  receivedCents: number,
  prostheticCostCents = 0,
): SplitResult {
  assertCents(receivedCents, "receivedCents");
  assertCents(prostheticCostCents, "prostheticCostCents");

  const distributableCents = receivedCents - prostheticCostCents;
  const professionalShareCents = Math.floor(distributableCents / 2);
  const clinicShareCents = distributableCents - professionalShareCents;

  return {
    receivedCents,
    prostheticCostCents,
    distributableCents,
    professionalShareCents,
    clinicShareCents,
    covered: distributableCents >= 0,
  };
}

export function calculatePatientDebt(
  budgetTotalCents: number,
  receivedCents: number,
): number {
  assertCents(budgetTotalCents, "budgetTotalCents");
  assertCents(receivedCents, "receivedCents");
  return Math.max(budgetTotalCents - receivedCents, 0);
}

export function euroToCents(value: unknown): number {
  if (typeof value === "number") return Math.round(value * 100);
  if (typeof value !== "string") return 0;
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/€/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function assertCents(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} deve ser um inteiro não negativo em cêntimos.`);
  }
}
