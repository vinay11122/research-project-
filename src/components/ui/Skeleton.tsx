import clsx from 'clsx'

interface Props {
  className?: string
}

export default function Skeleton({ className }: Props) {
  return (
    <div className={clsx("animate-pulse bg-slate-200 rounded", className)} />
  )
}

export function SkeletonKPI() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg bg-white shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 border-b p-4 h-12" />
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
