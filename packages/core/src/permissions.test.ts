import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPermission, canAccess, permissionsFor } from "./permissions.js";
import type { AccessContext } from "./permissions.js";

const ctx = (insideShift: boolean): AccessContext => ({
  tenantId: "t1",
  role: "receptionist",
  membershipId: "m1",
  insideShift,
});

test("owner tiene todos los permisos definidos", () => {
  const ownerPerms = permissionsFor("owner");
  for (const role of ["receptionist", "assistant", "doctor"] as const) {
    for (const p of permissionsFor(role)) {
      assert.ok(ownerPerms.includes(p), `owner sin permiso ${p} (lo tiene ${role})`);
    }
  }
  assert.equal(hasPermission("owner", "staff.manage"), true);
  assert.equal(hasPermission("owner", "payments.register"), true);
  assert.equal(hasPermission("owner", "receipts.issue"), true);
  assert.equal(hasPermission("owner", "arco.manage"), true);
});

test("assistant no tiene payments.register ni receipts.issue", () => {
  assert.equal(hasPermission("assistant", "payments.register"), false);
  assert.equal(hasPermission("assistant", "receipts.issue"), false);
  assert.equal(hasPermission("assistant", "inventory.manage"), true);
});

test("doctor tiene agenda.view_own pero no agenda.view_all", () => {
  assert.equal(hasPermission("doctor", "agenda.view_own"), true);
  assert.equal(hasPermission("doctor", "agenda.view_all"), false);
});

test("receptionist tiene agenda.view_all pero no staff.manage", () => {
  assert.equal(hasPermission("receptionist", "agenda.view_all"), true);
  assert.equal(hasPermission("receptionist", "staff.manage"), false);
});

test("canAccess: restricción activa + fuera de turno => negado", () => {
  assert.equal(canAccess(ctx(false), true), false);
});

test("canAccess: restricción activa + dentro de turno => permitido", () => {
  assert.equal(canAccess(ctx(true), true), true);
});

test("canAccess: sin restricción, fuera de turno sigue permitido", () => {
  assert.equal(canAccess(ctx(false), false), true);
});
