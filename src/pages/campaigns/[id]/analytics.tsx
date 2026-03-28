import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import PageShell from '@/components/layout/PageShell'
import CampaignTabs from '@/components/campaigns/CampaignTabs'
import CampaignAnalyticsKPIs from '@/components/analytics/CampaignAnalyticsKPIs'
import { Loading, ErrorState } from '@/components/ui/AsyncState'
import { fetchCampaign } from '@/lib/api/campaigns'
import {
  fetchCampaignOverview,
  fetchCampaignSteps,
  fetchCampaignTrend,
  fetchCampaignReplies,
} from '@/lib/api/analytics'
import { Campaign, CampaignAnalyticsOverview, CampaignStepAnalytics, Reply } from '@/types'
import dynamic from 'next/dynamic'
import { getSafeId } from '@/utils/route'
import { formatUTC } from '@/utils/formatDate'

// Dynamic imports for charts to prevent hydration mismatches
const CampaignFunnelChart = dynamic(
  () => import('@/components/analytics/CampaignFunnelChart'),
  { ssr: false }
)
const CampaignReplyTrendChart = dynamic(
  () => import('@/components/analytics/CampaignReplyTrendChart'),
  { ssr: false }
)
const CampaignStepAnalyticsTable = dynamic(
  () => import('@/components/analytics/CampaignStepAnalyticsTable'),
  { ssr: false }
)

export default function CampaignAnalyticsPage() {
  const router = useRouter()
  const campaignId = getSafeId(router.query.id)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [overview, setOverview] = useState<CampaignAnalyticsOverview | null>(null)
  const [steps, setSteps] = useState<CampaignStepAnalytics[]>([])
  const [trend, setTrend] = useState<{ date: string; replies: number }[]>([])
  const [replies, setReplies] = useState<Reply[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (campaignId === null) return

    setLoading(true)
    Promise.all([
      fetchCampaign(campaignId),
      fetchCampaignOverview(campaignId).catch(err => {
        if (err.message.includes('404')) {
          return {
            campaign_id: campaignId,
            sent: 0,
            opened: 0,
            clicked: 0,
            replied: 0,
            open_rate: 0,
            reply_rate: 0
          }
        }
        throw err
      }),
      fetchCampaignSteps(campaignId).catch(err => {
        if (err.message.includes('404')) return []
        throw err
      }),
      fetchCampaignTrend(campaignId).catch(() => []),
      fetchCampaignReplies(campaignId).catch(() => []),
    ])
      .then(([c, o, s, t, r]) => {
        setCampaign(c)
        setOverview(o)
        setSteps(s)
        setTrend(t)
        setReplies(r)
      })
      .catch((err) => {
        console.error(err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [campaignId, tick])

  if (loading) {
    return (
      <PageShell>
        <Loading />
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

  if (!campaign || !overview || campaignId === null) return null

  // Transform data for charts
  const funnelData = [
    { stage: 'Sent', value: overview.sent },
    { stage: 'Opened', value: overview.opened },
    { stage: 'Clicked', value: overview.clicked },
    { stage: 'Replied', value: overview.replied },
  ]

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <CampaignTabs campaignId={String(campaignId)} status={campaign.status} />
          
          <div className="flex gap-2">
            <button
              onClick={() => setTick(t => t + 1)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              Refresh Data
            </button>
          </div>
        </div>

        {overview.sent === 0 && replies.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm text-slate-600 font-medium">
              No analytics available yet.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Start the campaign to see results.
            </p>
          </div>
        ) : (
          <>
            {overview.sent > 0 && <CampaignAnalyticsKPIs data={overview} />}

            {overview.sent > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CampaignFunnelChart data={funnelData} />
                {trend.length > 0 ? (
                  <CampaignReplyTrendChart data={trend} />
                ) : (
                  <div className="rounded-lg bg-white p-5 border border-slate-200 shadow-sm flex flex-col justify-center items-center h-64">
                    <p className="text-sm text-slate-500 font-medium">No reply data over time</p>
                    <p className="text-xs text-slate-400">Trend will appear once replies are received.</p>
                  </div>
                )}
              </div>
            )}

            {steps.length > 0 && <CampaignStepAnalyticsTable data={steps} />}

            {/* Recent Replies section */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
                <h3 className="text-sm font-medium text-slate-700 uppercase tracking-wider">
                  Recent Replies
                </h3>
              </div>

              <ul className="divide-y divide-slate-50 text-sm">
                {replies.length > 0 ? (
                  replies.map((r, i) => (
                    <li key={i} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-slate-900">
                          {r.contact_email}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatUTC(r.received_at)}
                        </div>
                      </div>
                      <div className="mt-1 text-slate-500 line-clamp-2 whitespace-pre-wrap">
                        {r.snippet}
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-8 text-center text-slate-400">No replies yet</li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}
