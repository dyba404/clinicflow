import { ListSkeleton } from "@/components/console/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-2">
        <div className="h-6 w-48 animate-pulse rounded-full bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <ListSkeleton rows={5} />
      </div>
    </div>
  );
}
