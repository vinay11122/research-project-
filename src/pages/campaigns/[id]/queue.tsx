import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import PageShell from '@/components/layout/PageShell'
import CampaignTabs from '@/components/campaigns/CampaignTabs'
import { CampaignAPI, getCampaignQueue, type CampaignQueueItem } from '@/lib/api/campaigns'
import { Campaign } from '@/types/campaign'
import { Loading, ErrorState } from '@/components/ui/AsyncState'
import { formatUTC } from '@/utils/formatDate'
import { getSafeId } from '@/utils/route'
import { useToast } from '@/hooks/useToast'
import { 
  RefreshCcw, 
  Search, 
  Filter, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertCircle,
  Mail,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  ArrowRight
} from 'lucide-react'
import clsx from 'clsx'

export default function CampaignQueuePage() {
  const router = useRouter()
  const { toast } = useToast()
  const campaignId = getSafeId(router.query.id)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [queue, setQueue] = useState<CampaignQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [queueLoading, setQueueLoading] = useState(false)
  
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all')

  useEffect(() => {
    if (campaignId === null) return
    loadData(campaignId)
  }, [campaignId])

  async function loadData(id: number) {
    setLoading(true)
    try {
      const [campaignData, queueData] = await Promise.all([
        CampaignAPI.get(id),
        getCampaignQueue(id, { limit: 300 })
      ])
      setCampaign(campaignData)
      setQueue(queueData)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function refreshQueue() {
    if (campaignId === null) return
    setQueueLoading(true)
    try {
      const items = await getCampaignQueue(campaignId, { limit: 300 })
      setQueue(items)
      toast('Queue refreshed', 'info')
    } catch (e: any) {
      toast(e.message || 'Failed to refresh queue', 'error')
    } finally {
      setQueueLoading(false)
    }
  }

  const filteredQueue = queue.filter(item => {
    const matchesSearch = item.contact_email?.toLowerCase().includes(search.toLowerCase()) || String(item.contact_id).includes(search)
    const matchesFilter = filter === 'all' || item.status === filter
    return matchesSearch && matchesFilter
  })

  if (loading) return <PageShell><Loading /></PageShell>
  if (error) return <PageShell><ErrorState error={error} /></PageShell>
  if (!campaign || campaignId === null) return null

  return (
    <PageShell>
      <div className="space-y-8 max-w-[1400px] mx-auto">
        <CampaignTabs campaignId={String(campaignId)} status={campaign.status} />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              Delivery Queue
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">Live</span>
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-1">Monitor automated email scheduling and history</p>
          </div>
          
          <button
            onClick={refreshQueue}
            disabled={queueLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCcw className={clsx("h-4 w-4", queueLoading && "animate-spin")} />
            {queueLoading ? 'Refreshing...' : 'Refresh Queue'}
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search by email or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-slate-50/50"
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
            <FilterChip active={filter === 'pending'} onClick={() => setFilter('pending')} label="Pending" />
            <FilterChip active={filter === 'sent'} onClick={() => setFilter('sent')} label="Sent" />
            <FilterChip active={filter === 'failed'} onClick={() => setFilter('failed')} label="Failed" />
          </div>
        </div>

        {/* Queue Table */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 border-b border-slate-200">
                <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4 text-center">Step</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Scheduled At (UTC)</th>
                  <th className="px-6 py-4 text-right">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQueue.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-[10px]">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-bold text-slate-900 truncate max-w-[200px]">
                          {q.contact_email || `ID: ${q.contact_id}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center">
                        <span className="h-6 w-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] border border-indigo-100">
                          {q.step_number ?? '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={q.status as any} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px] font-medium">
                        <Clock className="h-3 w-3 opacity-40" />
                        {formatUTC(q.scheduled_at).replace(' UTC', '')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {q.template_id && (
                          <Link href={`/templates/${q.template_id}`} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 rounded-lg border border-transparent hover:border-indigo-100">
                            <Mail className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 rounded-lg border border-transparent">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredQueue.length === 0 && (
              <div className="py-20 text-center text-slate-400">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-10" />
                <p className="font-bold">No queued items found</p>
                <p className="text-xs mt-1">Try adjusting your filters or search query.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function FilterChip({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-4 py-1.5 rounded-full text-xs font-bold transition-all border shrink-0",
        active 
          ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-200" 
          : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
      )}
    >
      {label}
    </button>
  )
}

function StatusBadge({ status }: { status: 'pending' | 'sent' | 'failed' | 'skipped' | 'sending' }) {
  const config = {
    pending: { label: 'Scheduled', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock className="h-3 w-3" /> },
    sending: { label: 'In Flight', color: 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse', icon: <RefreshCcw className="h-3 w-3 animate-spin" /> },
    sent: { label: 'Delivered', color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-700 border-red-200', icon: <AlertCircle className="h-3 w-3" /> },
    skipped: { label: 'Skipped', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: <ArrowRight className="h-3 w-3" /> },
  }

  const c = config[status] || config.pending

  return (
    <span className={clsx(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border shadow-sm",
      c.color
    )}>
      {c.icon}
      {c.label}
    </span>
  )
}

