export function fmtPEN(n: number): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
}

export function fmtHora(d: Date | string): string {
  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Lima",
  }).format(typeof d === "string" ? new Date(d) : d);
}

export function fmtFechaRelativa(fecha: string): string {
  const dia =
    fecha.length > 10
      ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date(fecha))
      : fecha;
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  if (dia === hoy) return "hoy";
  const a = new Date(`${hoy}T00:00:00`);
  const b = new Date(`${dia}T00:00:00`);
  const diff = Math.round((a.getTime() - b.getTime()) / 86_400_000);
  if (diff === 1) return "ayer";
  if (diff > 1) return `hace ${diff} días`;
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" }).format(b);
}
