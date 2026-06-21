import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-6">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-3 h-8 w-28" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-4 lg:col-span-2">
          <Skeleton className="h-[300px] w-full" />
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-teal-500/10 bg-navy-700/60 p-6">
          <Skeleton className="h-32 w-32 rounded-full" />
        </div>
      </div>
      <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-6">
        <Skeleton className="mb-4 h-5 w-32" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="mb-2 h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
