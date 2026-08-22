export interface ScheduleWindow {
  dayOfWeek: number;
  startMin: number;
  endMin: number;
}

export interface BusyRange {
  startMin: number;
  endMin: number;
}

export interface Slot {
  startMin: number;
  endMin: number;
  startTime: string;
  endTime: string;
}

export interface GenerateSlotsInput {
  date: string;
  durationMin: number;
  bufferMin?: number;
  stepMin?: number;
  leadTimeMin?: number;
  nowMin?: number | null;
  windows: ScheduleWindow[];
  busy: BusyRange[];
  maxSlots?: number;
}

export function dayOfWeekIn(date: string): number {
  const parts = date.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function nowLocalPartsIn(now: Date, timezone: string): { date: string; min: number } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(now)) parts[p.type] = p.value;
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  return { date, min: hour * 60 + Number(parts.minute) };
}

export function parseTimeToMin(time: string): number {
  const parts = time.split(":");
  const h = Number(parts[0] ?? "0");
  const m = Number(parts[1] ?? "0");
  return h * 60 + m;
}

export function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function overlaps(aStart: number, aEnd: number, b: BusyRange): boolean {
  return aStart < b.endMin && aEnd > b.startMin;
}

export function generateSlots(input: GenerateSlotsInput): Slot[] {
  const {
    date,
    durationMin,
    bufferMin = 0,
    stepMin = 15,
    leadTimeMin = 30,
    nowMin = null,
    windows,
    busy,
    maxSlots = 48,
  } = input;

  const dow = dayOfWeekIn(date);
  const occupied = durationMin + bufferMin;
  const todayWindows = windows
    .filter((w) => w.dayOfWeek === dow && w.endMin > w.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  const out: Slot[] = [];
  for (const w of todayWindows) {
    let start = w.startMin;
    if (nowMin !== null) {
      const earliest = nowMin + leadTimeMin;
      if (earliest > start) {
        start = earliest;
      }
    }
    let candidate = Math.ceil(start / stepMin) * stepMin;
    while (candidate + occupied <= w.endMin && out.length < maxSlots) {
      if (!busy.some((b) => overlaps(candidate, candidate + occupied, b))) {
        out.push({
          startMin: candidate,
          endMin: candidate + durationMin,
          startTime: minToTime(candidate),
          endTime: minToTime(candidate + durationMin),
        });
      }
      candidate += stepMin;
    }
  }
  return out;
}
