import { useEffect, useState } from 'react'
import PageShell from '@/components/layout/PageShell'
import StatCard from '@/components/ui/StatCard'
import { fetchGlobalAnalytics, fetchCampaignAnalytics } from '@/lib/api/analytics'
import { Loading, ErrorState } from '@/components/ui/AsyncState'
import { SkeletonKPI, SkeletonTable } from '@/components/ui/Skeleton'
import { 
  BarChart3, 
  Send, 
  MousePointer2, 
  MessageSquare, 
  Users,
  TrendingUp,
  ArrowUpRight
} from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

// SSR-safe chart
const FunnelChart = dynamic(
  () => import('@/components/analytics/FunnelChart'),
  { ssr: false }
)

export default function GlobalAnalyticsPage() {
  const [stats, setStats] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [global, allCampaigns] = await Promise.all([
        fetchGlobalAnalytics(),
        fetchCampaignAnalytics()
      ])
      setStats(global)
      setCampaigns(allCampaigns ?? [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="space-y-8 max-w-[1400px] mx-auto">
          <SkeletonKPI />
          <SkeletonTable rows={8} />
        </div>
      </PageShell>
    )
  }

  if (error) return <PageShell><ErrorState error={error} /></PageShell>

  // Aggregate totals for the funnel
  const totals = campaigns.reduce((acc, c) => ({
    sent: acc.sent + (c.sent || 0),
    opened: acc.opened + (c.opened || 0),
    clicked: acc.clicked + (c.clicked || 0),
    replied: acc.replied + (c.replied || 0),
  }), { sent: 0, opened: 0, clicked: 0, replied: 0 })

  return (
    <PageShell>
      <div className="space-y-8 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-indigo-600" />
              Global Analytics
            </h1>
            <p className="text-sm text-slate-500 font-medium">Performance across all outreach campaigns</p>
          </div>
          <button 
            onClick={loadData}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Total Sent" 
            value={totals.sent} 
            icon={<Send className="h-4 w-4" />} 
            color="slate" 
          />
          <StatCard 
            title="Avg Open Rate" 
            value={`${totals.sent > 0 ? Math.round((totals.opened / totals.sent) * 100) : 0}%`} 
            icon={<TrendingUp className="h-4 w-4" />} 
            color="indigo" 
          />
          <StatCard 
            title="Total Replies" 
            value={totals.replied} 
            icon={<MessageSquare className="h-4 w-4" />} 
            color="green" 
          />
          <StatCard 
            title="Total Contacts" 
            value={stats.total_contacts} 
            icon={<Users className="h-4 w-4" />} 
            color="blue" 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Table */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Campaign Performance</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/50 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Campaign</th>
                      <th className="px-6 py-4 text-center">Sent</th>
                      <th className="px-6 py-4 text-center">Open %</th>
                      <th className="px-6 py-4 text-center">Replies</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {campaigns.map((c: any) => {
                      const openRate = c.sent > 0 ? Math.round((c.opened / c.sent) * 100) : 0
                      return (
                        <tr key={c.campaign_id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-900">{c.campaign_name}</span>
                          </td>
                          <td className="px-6 py-4 text-center font-medium text-slate-600">{c.sent}</td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-bold text-slate-700">{openRate}%</span>
                              <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                <div className="h-full bg-indigo-500" style={{ width: `${openRate}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-green-600">{c.replied}</td>
                          <td className="px-6 py-4 text-right">
                            <Link href={`/campaigns/${c.campaign_id}/analytics`} className="text-indigo-600 hover:text-indigo-700 font-bold text-xs inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              Details <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Aggregate Funnel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Overall Funnel</h3>
              <FunnelChart 
                sent={totals.sent}
                opened={totals.opened}
                clicked={totals.clicked}
                replied={totals.replied}
              />
              <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-tight">Conversion Insight</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Your current reply rate across all campaigns is <b>{totals.sent > 0 ? Math.round((totals.replied / totals.sent) * 100) : 0}%</b>. 
                  Try A/B testing your subject lines to improve open rates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
