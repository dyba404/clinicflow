import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSlots, dayOfWeekIn, minToTime, parseTimeToMin } from "./slots.js";

const SUNDAY = "2026-08-16";

test("dayOfWeekIn usa convención JS (0=domingo)", () => {
  assert.equal(dayOfWeekIn(SUNDAY), 0);
});

test("sin schedules para el día devuelve vacío", () => {
  const slots = generateSlots({
    date: SUNDAY,
    durationMin: 30,
    windows: [{ dayOfWeek: 1, startMin: 480, endMin: 720 }],
    busy: [],
  });
  assert.deepEqual(slots, []);
});

test("ventana inválida (endMin <= startMin) no produce slots", () => {
  const slots = generateSlots({
    date: SUNDAY,
    durationMin: 30,
    windows: [{ dayOfWeek: 0, startMin: 480, endMin: 480 }],
    busy: [],
  });
  assert.deepEqual(slots, []);
});

test("slots caen dentro de la franja del doctor y respetan el final", () => {
  const slots = generateSlots({
    date: SUNDAY,
    durationMin: 60,
    windows: [{ dayOfWeek: 0, startMin: 480, endMin: 600 }],
    busy: [],
  });
  assert.equal(slots.length, 5);
  assert.equal(slots[0]?.startMin, 480);
  assert.equal(slots[0]?.startTime, "08:00");
  const last = slots[slots.length - 1];
  assert.equal(last?.startMin, 540);
  assert.equal(last?.endTime, "10:00");
});

test("duración + buffer deben caber completos dentro de la franja", () => {
  const slots = generateSlots({
    date: SUNDAY,
    durationMin: 45,
    bufferMin: 30,
    windows: [{ dayOfWeek: 0, startMin: 480, endMin: 540 }],
    busy: [],
  });
  assert.deepEqual(slots, []);
});

test("paso por defecto es 15 minutos", () => {
  const slots = generateSlots({
    date: SUNDAY,
    durationMin: 30,
    windows: [{ dayOfWeek: 0, startMin: 480, endMin: 600 }],
    busy: [],
  });
  assert.ok(slots.length >= 2);
  for (const s of slots) {
    assert.equal(s.startMin % 15, 0);
  }
  for (let i = 1; i < slots.length; i++) {
    assert.equal(slots[i]!.startMin - slots[i - 1]!.startMin, 15);
  }
});

test("buffer excluye candidatos que terminarían en buffer antes de un ocupado", () => {
  const busy = [{ startMin: 600, endMin: 630 }];
  const sinBuffer = generateSlots({
    date: SUNDAY,
    durationMin: 30,
    bufferMin: 0,
    stepMin: 30,
    windows: [{ dayOfWeek: 0, startMin: 480, endMin: 720 }],
    busy,
  });
  const conBuffer = generateSlots({
    date: SUNDAY,
    durationMin: 30,
    bufferMin: 30,
    stepMin: 30,
    windows: [{ dayOfWeek: 0, startMin: 480, endMin: 720 }],
    busy,
  });
  assert.ok(sinBuffer.some((s) => s.startMin === 570));
  assert.ok(!conBuffer.some((s) => s.startMin === 570));
});

test("ningún slot se solapa con rangos ocupados (duración + buffer)", () => {
  const busy = [
    { startMin: 540, endMin: 600 },
    { startMin: 660, endMin: 690 },
  ];
  const slots = generateSlots({
    date: SUNDAY,
    durationMin: 30,
    bufferMin: 15,
    windows: [{ dayOfWeek: 0, startMin: 480, endMin: 780 }],
    busy,
  });
  assert.ok(slots.length > 0);
  for (const s of slots) {
    for (const b of busy) {
      assert.ok(
        !(s.startMin < b.endMin && s.startMin + 45 > b.startMin),
        `slot ${s.startTime} se solapa con ocupado ${minToTime(b.startMin)}-${minToTime(b.endMin)}`,
      );
    }
  }
});

test("maxSlots limita la cantidad de slots", () => {
  const slots = generateSlots({
    date: SUNDAY,
    durationMin: 30,
    maxSlots: 4,
    windows: [{ dayOfWeek: 0, startMin: 480, endMin: 1080 }],
    busy: [],
  });
  assert.equal(slots.length, 4);
});

test("slot expone startMin/endMin (duración real, sin buffer) y cadenas HH:MM", () => {
  const slots = generateSlots({
    date: SUNDAY,
    durationMin: 45,
    bufferMin: 15,
    stepMin: 15,
    windows: [{ dayOfWeek: 0, startMin: 480, endMin: 720 }],
    busy: [],
  });
  const first = slots[0]!;
  assert.equal(first.startMin, 480);
  assert.equal(first.endMin, 525);
  assert.equal(first.startTime, "08:00");
  assert.equal(first.endTime, "08:45");
  assert.equal(parseTimeToMin(first.startTime), first.startMin);
});
