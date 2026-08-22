import { ListSkeleton } from "@/components/console/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <div className="h-6 w-48 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={`col-${i}`} className="rounded-2xl border bg-card p-4">
            <ListSkeleton rows={5} />
          </div>
        ))}
      </div>
    </div>
  );
}
