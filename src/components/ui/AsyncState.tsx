export function Loading() {
  return (
    <div className="text-sm text-slate-500">
      Loading…
    </div>
  )
}

export function ErrorState({
  error,
}: {
  error: string
}) {
  return (
    <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
      {error}
    </div>
  )
}
