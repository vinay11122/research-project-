import { SequenceStep } from '@/types/sequence'

interface Props {
  step: SequenceStep
  onEdit?: (step: SequenceStep) => void
  onRemove?: (id: number) => void
}

export default function SequenceStepCard({
  step,
  onEdit,
  onRemove,
}: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-slate-900">
            Step {step.step_number}
          </div>

          <div className="mt-1 text-sm text-slate-500">
            Send after{' '}
            <span className="font-medium text-slate-700">
              {step.delay_days} day
              {step.delay_days !== 1 && 's'}
            </span>
          </div>

          <div className="mt-2 text-sm">
            {step.template_name ? (
              <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                {step.template_name}
              </span>
            ) : (
              <span className="text-slate-400 text-xs italic">
                No template attached
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onEdit?.(step)}
            className="text-xs text-indigo-600 hover:underline"
          >
            Edit
          </button>

          <button
            onClick={() => onRemove?.(step.id)}
            className="text-xs text-red-600 hover:underline"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}