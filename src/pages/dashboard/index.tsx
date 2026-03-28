import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import PageShell from '@/components/layout/PageShell'
import StatCard from '@/components/ui/StatCard'
import RecentCampaignsTable from '@/components/analytics/RecentCampaignsTable'
import { ErrorState } from '@/components/ui/AsyncState'
import { SkeletonKPI, SkeletonTable } from '@/components/ui/Skeleton'
import { fetchDashboardOverview } from '@/lib/api/dashboard'
import { DashboardOverview } from '@/types/dashboard'
import { fetchCampaignAnalytics } from '@/lib/api/analytics'
import type { CampaignStepAnalytics } from '@/types'
import { 
  LayoutDashboard, 
  Send, 
  MessageSquare, 
  TrendingUp, 
  ArrowRight,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'

// Make chart SSR-safe to prevent hydration mismatches
const FunnelChart = dynamic(
  () => import('@/components/analytics/FunnelChart'),
  { ssr: false }
)

export default function Dashboard() {
  const [data, setData] = useState<DashboardOverview | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignStepAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    setLoading(true)
    try {
      const [overview, analyticsData] = await Promise.all([
        fetchDashboardOverview(),
        fetchCampaignAnalytics()
      ])
      setData(overview)
      setCampaigns((analyticsData ?? []).slice(0, 5)) // Show only latest 5
    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="space-y-8 max-w-[1400px] mx-auto">
          <div className="h-12 w-48 bg-slate-200 animate-pulse rounded-lg" />
          <SkeletonKPI />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2"><SkeletonTable rows={5} /></div>
            <div className="h-96 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          </div>
        </div>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell>
        <ErrorState error={error} />
      </PageShell>
    )
  }

  if (!data) return null

  // Transform data for table
  const formattedCampaigns = campaigns.map((c: any) => ({
    id: c.campaign_id,
    name: c.campaign_name,
    status: c.status,
    sent: c.sent, 
    opened: c.opened,
    replied: c.replied
  }))

  return (
    <PageShell>
      <div className="space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-700">
        {/* Page title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <LayoutDashboard className="h-6 w-6 text-indigo-600" />
              Dashboard
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Real-time overview of your outreach ecosystem
            </p>
          </div>
          
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-700 uppercase tracking-widest">Growth Engine Active</span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Campaigns"
            value={data.total_campaigns}
            icon={<LayoutDashboard className="h-4 w-4" />}
            color="indigo"
          />
          <StatCard
            title="Total Sends"
            value={data.emails_sent}
            icon={<Send className="h-4 w-4" />}
            color="slate"
          />
          <StatCard
            title="Engagement"
            value={data.replies}
            icon={<MessageSquare className="h-4 w-4" />}
            color="green"
          />
          <StatCard
            title="Avg Success Rate"
            value={`${data.avg_reply_rate}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            color="blue"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Table section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Recent Activity</h3>
              <Link href="/campaigns" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <RecentCampaignsTable campaigns={formattedCampaigns} />
          </div>

          {/* Chart section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-2 text-center">Engagement Funnel</h3>
            <FunnelChart 
              sent={data.emails_sent}
              opened={Math.round(data.emails_sent * 0.6)}   // TEMP estimate
              clicked={Math.round(data.emails_sent * 0.25)} // TEMP estimate
              replied={data.replies}
            />
          </div>
        </div>
      </div>
    </PageShell>
  )
}
