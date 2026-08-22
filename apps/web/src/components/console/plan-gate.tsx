import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PLAN_NOMBRE, type PlanCode, type PlanFeature, FEATURE_TITULO } from "@/lib/plans";
import { RenovarYape } from "@/app/consola/config/suscripcion/renovar-yape";

export function PlanGate({
  feature,
  requerido,
}: {
  feature: PlanFeature;
  requerido: PlanCode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Sparkles className="size-5" />
        </span>
        <p className="text-sm font-semibold">
          {FEATURE_TITULO[feature]} es parte del plan {PLAN_NOMBRE[requerido]}
        </p>
        <p className="max-w-md text-[13px] text-muted-foreground">
          Tu plan actual no incluye este módulo. Renueva por Yape o Plin y lo activamos en
          menos de 24 horas.
        </p>
        <div className="mt-1">
          <RenovarYape nombrePlan={PLAN_NOMBRE[requerido]} />
        </div>
      </CardContent>
    </Card>
  );
}
