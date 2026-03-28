import clsx from 'clsx'
import type { CampaignStatus } from '@/types/campaign'

interface Props {
  status: CampaignStatus
}

export default function CampaignStatusBadge({ status }: Props) {
  const styles: Record<CampaignStatus, string> = {
    draft: 'bg-slate-100 text-slate-700',
    validated: 'bg-indigo-100 text-indigo-700',
    running: 'bg-green-100 text-green-700',
    paused: 'bg-amber-100 text-amber-700',
    completed: 'bg-blue-100 text-blue-700',
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider',
        styles[status] || 'bg-slate-100 text-slate-700'
      )}
    >
      {status}
    </span>
  )
}