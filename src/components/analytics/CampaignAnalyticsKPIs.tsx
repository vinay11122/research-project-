import StatCard from '@/components/ui/StatCard'
import { CampaignAnalyticsOverview } from '@/types/analytics'

interface Props {
  data: CampaignAnalyticsOverview
}

export default function CampaignAnalyticsKPIs({ data }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Emails Sent"
        value={data.sent.toLocaleString()}
      />

      <StatCard
        title="Open Rate"
        value={`${data.open_rate}%`}
      />

      <StatCard
        title="Reply Rate"
        value={`${data.reply_rate}%`}
      />

      <StatCard
        title="Replies"
        value={data.replied.toLocaleString()}
      />
    </div>
  )
}