export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={`kpi-${i}`}
          className="flex min-h-[110px] flex-col justify-between rounded-2xl border bg-card p-5"
        >
          <div className="h-3.5 w-20 animate-pulse rounded-full bg-muted" />
          <div className="mt-3 h-7 w-28 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={`row-${i}`}
          className="h-12 animate-pulse rounded-lg bg-muted"
        />
      ))}
    </div>
  );
}

export function PacientesSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-44 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-full bg-muted" />
      </div>
      <div className="h-9 w-72 max-w-full animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`pac-${i}`} className="rounded-2xl border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="min-w-0 flex-1 space-y-2 py-1">
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded-full bg-muted" />
              </div>
            </div>
            <div className="mt-4 h-3 w-full animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FichaPacienteSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6" aria-busy="true" aria-label="Cargando ficha del paciente">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="size-16 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-3 py-1">
            <div className="h-5 w-56 animate-pulse rounded-full bg-muted" />
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="h-4 animate-pulse rounded-full bg-muted" />
              <div className="h-4 animate-pulse rounded-full bg-muted" />
              <div className="h-4 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`stat-${i}`} className="space-y-2 rounded-xl border bg-muted/30 p-4">
              <div className="h-3 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-7 w-12 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <ListSkeleton rows={4} />
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <ListSkeleton rows={4} />
        </div>
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <ListSkeleton rows={5} />
      </div>
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-4">
        <div className="h-9 w-72 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-full bg-muted" />
      </div>
      <KpiSkeleton />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border bg-card p-5 lg:col-span-3">
          <ListSkeleton rows={6} />
        </div>
        <div className="rounded-2xl border bg-card p-5 lg:col-span-2">
          <ListSkeleton rows={4} />
        </div>
      </div>
    </div>
  );
}
