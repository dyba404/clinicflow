import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-teal-600",
  "bg-sky-600",
  "bg-violet-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-emerald-600",
  "bg-indigo-600",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (a + b).toUpperCase();
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        color,
        className,
      )}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
