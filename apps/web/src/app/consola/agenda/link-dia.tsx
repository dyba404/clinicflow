"use client";

import type { ReactNode } from "react";
import { useNavegar } from "@/lib/navegar";

export function LinkDia({
  fechaISO,
  className,
  children,
}: {
  fechaISO: string;
  className?: string;
  children: ReactNode;
}) {
  const ir = useNavegar();
  return (
    <button
      type="button"
      className={className}
      onClick={() => ir(`/consola/agenda?vista=dia&fecha=${fechaISO}`)}
    >
      {children}
    </button>
  );
}