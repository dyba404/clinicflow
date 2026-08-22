"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);

  return <>{children}</>;
}
