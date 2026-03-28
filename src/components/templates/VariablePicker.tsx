import { TEMPLATE_VARIABLES } from '@/lib/templateVariables'

interface Props {
  onInsert: (value: string) => void
}

export default function VariablePicker({ onInsert }: Props) {
  return (
    <div className="rounded-md border p-3 space-y-2 bg-white">
      <p className="text-sm font-medium text-slate-700">Insert variable</p>
      <div className="grid grid-cols-2 gap-2">
        {TEMPLATE_VARIABLES.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => onInsert(v.value)}
            className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors text-left"
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}
