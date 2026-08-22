"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  icon,
  description,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  icon?: ReactNode;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-6 shadow-lg",
          className,
        )}
      >
        {title ? (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                {icon}
                {title}
              </h3>
              {description ? (
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
