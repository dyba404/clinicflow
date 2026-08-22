import { test } from "node:test";
import assert from "node:assert/strict";
import { canTransition, assertTransition } from "./appointment-state.js";

test("solicitada -> confirmada OK", () => {
  assert.equal(canTransition("solicitada", "confirmada"), true);
});

test("confirmada -> en_espera OK", () => {
  assert.equal(canTransition("confirmada", "en_espera"), true);
});

test("en_atencion -> atendida OK", () => {
  assert.equal(canTransition("en_atencion", "atendida"), true);
});

test("solicitada -> atendida NO OK (debe pasar por el flujo completo)", () => {
  assert.equal(canTransition("solicitada", "atendida"), false);
});

test("cancelada es terminal: ninguna salida permitida", () => {
  const targets = [
    "solicitada",
    "confirmada",
    "en_espera",
    "en_atencion",
    "atendida",
    "no_show",
  ] as const;
  for (const t of targets) {
    assert.equal(canTransition("cancelada", t), false);
  }
});

test("atendida es terminal", () => {
  assert.equal(canTransition("atendida", "cancelada"), false);
  assert.equal(canTransition("atendida", "en_atencion"), false);
});

test("reversas seguras permitidas", () => {
  assert.equal(canTransition("confirmada", "solicitada"), true);
  assert.equal(canTransition("en_espera", "confirmada"), true);
  assert.equal(canTransition("en_atencion", "en_espera"), true);
  assert.equal(canTransition("no_show", "confirmada"), true);
});

test("no_show ya no es terminal; cancelada sí lo es", () => {
  assert.equal(canTransition("cancelada", "confirmada"), false);
  assert.equal(canTransition("no_show", "en_espera"), false);
});

test("transiciones inválidas conocidas", () => {
  assert.equal(canTransition("solicitada", "en_atencion"), false);
  assert.equal(canTransition("en_espera", "atendida"), false);
  assert.equal(canTransition("confirmada", "atendida"), false);
  assert.equal(canTransition("en_atencion", "cancelada"), false);
});

test("assertTransition lanza en transición inválida", () => {
  assert.throws(() => assertTransition("cancelada", "atendida"), /inválida/i);
  assert.doesNotThrow(() => assertTransition("solicitada", "confirmada"));
});
