import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePatientDebt,
  calculateSplit,
  euroToCents,
} from "../lib/finance.ts";

test("divide o valor sem protético em partes iguais", () => {
  const result = calculateSplit(300_000, 0);
  assert.equal(result.professionalShareCents, 150_000);
  assert.equal(result.clinicShareCents, 150_000);
  assert.equal(result.covered, true);
});

test("retira o custo protético antes da divisão", () => {
  const result = calculateSplit(300_000, 60_000);
  assert.equal(result.distributableCents, 240_000);
  assert.equal(result.professionalShareCents, 120_000);
  assert.equal(result.clinicShareCents, 120_000);
  assert.equal(
    result.professionalShareCents +
      result.clinicShareCents +
      result.prostheticCostCents,
    result.receivedCents,
  );
});

test("atribui à clínica o cêntimo indivisível e mantém a soma exata", () => {
  const result = calculateSplit(10_001, 0);
  assert.equal(result.professionalShareCents, 5_000);
  assert.equal(result.clinicShareCents, 5_001);
  assert.equal(result.professionalShareCents + result.clinicShareCents, 10_001);
});

test("sinaliza quando o recebido ainda não cobre o laboratório", () => {
  const result = calculateSplit(30_000, 50_000);
  assert.equal(result.covered, false);
  assert.equal(result.distributableCents, -20_000);
});

test("a dívida do paciente nunca fica negativa", () => {
  assert.equal(calculatePatientDebt(120_000, 90_000), 30_000);
  assert.equal(calculatePatientDebt(120_000, 140_000), 0);
});

test("converte valores europeus em cêntimos", () => {
  assert.equal(euroToCents("1.234,56"), 123_456);
  assert.equal(euroToCents("70,00 €"), 7_000);
  assert.equal(euroToCents(""), 0);
});
