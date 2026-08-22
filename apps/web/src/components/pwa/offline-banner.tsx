"use client";

import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] bg-amber-400 px-4 py-1.5 text-center text-xs font-medium text-amber-950">
      Sin conexión: los cambios pueden no guardarse.
    </div>
  );
}
