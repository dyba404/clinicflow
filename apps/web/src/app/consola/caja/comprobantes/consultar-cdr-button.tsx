"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, SearchCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConsultarCdrButton({
  id,
  numero,
}: {
  id: string;
  numero: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={loading}
      title="SUNAT procesa el comprobante de forma diferida: consulta aquí el CDR"
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/caja/comprobantes/${id}/emitir`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ consultarCdr: true }),
          });
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
            estado?: string;
            message?: string | null;
          };
          if (!res.ok) {
            toast.error(j.message ?? j.error ?? "No se pudo consultar el CDR");
            return;
          }
          if (j.estado === "aceptado") {
            toast.success(`CDR del ${numero} aceptado por SUNAT`);
            router.refresh();
          } else if (j.estado === "rechazado") {
            toast.error(`El CDR del ${numero} fue rechazado por SUNAT. ${j.message ?? ""}`);
            router.refresh();
          } else {
            toast.info(
              j.message ?? "SUNAT aún no tiene el CDR disponible. Consulta más tarde.",
            );
          }
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <SearchCheck className="size-3.5" />}
      Consultar CDR
    </Button>
  );
}
