import CampaignStatusBadge from '@/components/campaigns/CampaignStatusBadge'
import Link from 'next/link'

interface Campaign {
  id: number
  name: string
  status: any // Using any to avoid strict union check for simplicity in mock data
  sent: number
  opened: number
  replied: number
}

interface Props {
  campaigns: Campaign[]
}

export default function RecentCampaignsTable({ campaigns }: Props) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm border border-slate-200 h-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">
          Recent Campaigns
        </h3>
        <Link
          href="/campaigns"
          className="text-sm text-indigo-600 hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="py-2 font-medium">Campaign</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Sent</th>
              <th className="py-2 font-medium">Opened</th>
              <th className="py-2 font-medium">Replied</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 font-medium text-slate-900">
                  {c.name}
                </td>
                <td className="py-3">
                  <CampaignStatusBadge status={c.status} />
                </td>
                <td className="py-3 text-slate-600">{c.sent}</td>
                <td className="py-3 text-slate-600">{c.opened}</td>
                <td className="py-3 text-slate-600">{c.replied}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
