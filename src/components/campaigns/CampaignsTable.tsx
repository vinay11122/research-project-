import Link from 'next/link'
import clsx from 'clsx'
import { Campaign } from '@/types/campaign'
import CampaignStatusBadge from './CampaignStatusBadge'
import { formatDate } from '@/utils/formatDate'
import { MoreHorizontal, Play, Pause, CheckCircle, Trash2, ArrowRight } from 'lucide-react'

interface Props {
  campaigns: Campaign[]
  onStatusChange?: (
    id: number,
    status: Campaign['status']
  ) => void
  onDelete?: (id: number) => void
}

export default function CampaignsTable({ campaigns, onStatusChange, onDelete }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50/50 border-b border-slate-200">
          <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <th className="px-6 py-4">Campaign Name</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Created</th>
            <th className="px-6 py-4 text-right">Actions</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {campaigns.map((c) => (
            <tr
              key={c.id}
              className="group hover:bg-slate-50/50 transition-colors"
            >
              <td className="px-6 py-4">
                <Link
                  href={`/campaigns/${c.id}`}
                  className="font-bold text-slate-900 hover:text-indigo-600 transition-colors block"
                >
                  {c.name}
                </Link>
                {c.description && (
                  <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                    {c.description}
                  </div>
                )}
              </td>

              <td className="px-6 py-4">
                <CampaignStatusBadge status={c.status} />
              </td>

              <td className="px-6 py-4 text-slate-500 font-medium">
                {formatDate(c.created_at)}
              </td>

              <td className="px-6 py-4">
                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {c.status === 'draft' && (
                    <IconButton
                      icon={<Play className="h-3.5 w-3.5" />}
                      label="Start"
                      onClick={() => onStatusChange?.(c.id, 'running')}
                      color="green"
                    />
                  )}

                  {c.status === 'running' && (
                    <IconButton
                      icon={<Pause className="h-3.5 w-3.5" />}
                      label="Pause"
                      onClick={() => onStatusChange?.(c.id, 'paused')}
                      color="amber"
                    />
                  )}

                  {(c.status === 'running' || c.status === 'paused') && (
                    <IconButton
                      icon={<CheckCircle className="h-3.5 w-3.5" />}
                      label="Complete"
                      onClick={() => onStatusChange?.(c.id, 'completed')}
                      color="blue"
                    />
                  )}

                  <IconButton
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    label="Delete"
                    onClick={() => onDelete?.(c.id)}
                    color="red"
                  />
                  
                  <Link href={`/campaigns/${c.id}`}>
                    <IconButton
                      icon={<ArrowRight className="h-3.5 w-3.5" />}
                      label="View"
                      onClick={() => {}}
                      color="indigo"
                    />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IconButton({
  icon,
  label,
  onClick,
  color = 'slate',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  color?: 'indigo' | 'green' | 'amber' | 'red' | 'blue' | 'slate'
}) {
  const colors = {
    indigo: 'hover:bg-indigo-50 text-indigo-600 border-indigo-100',
    green: 'hover:bg-green-50 text-green-600 border-green-100',
    amber: 'hover:bg-amber-50 text-amber-600 border-amber-100',
    red: 'hover:bg-red-50 text-red-600 border-red-100',
    blue: 'hover:bg-blue-50 text-blue-600 border-blue-100',
    slate: 'hover:bg-slate-50 text-slate-600 border-slate-100',
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      title={label}
      className={clsx(
        "p-2 rounded-lg border border-transparent transition-all active:scale-95",
        colors[color]
      )}
    >
      {icon}
    </button>
  )
}