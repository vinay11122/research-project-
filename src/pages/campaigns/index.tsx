import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageShell from '@/components/layout/PageShell'
import CampaignsTable from '@/components/campaigns/CampaignsTable'
import { Campaign, CampaignStatus } from '@/types/campaign'
import { CampaignAPI } from '@/lib/api/campaigns'
import { fetchGlobalAnalytics } from '@/lib/api/analytics'
import { ErrorState } from '@/components/ui/AsyncState'
import { SkeletonKPI, SkeletonTable } from '@/components/ui/Skeleton'
import StatCard from '@/components/ui/StatCard'
import { useToast } from '@/hooks/useToast'
import { Plus, LayoutGrid, Radio, PauseCircle, CheckCircle2, ListFilter } from 'lucide-react'
import clsx from 'clsx'

export default function CampaignsPage() {
  const { toast } = useToast()
  const [data, setData] = useState<Campaign[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<CampaignStatus | 'all'>('all')

  useEffect(() => {
    loadPageData()
  }, [])

  async function loadPageData() {
    setLoading(true)
    try {
      const [campaigns, globalStats] = await Promise.all([
        CampaignAPI.list(),
        fetchGlobalAnalytics()
      ])
      setData(campaigns)
      setStats(globalStats)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(id: number, status: Campaign['status']) {
    try {
      if (status === 'paused') {
        await CampaignAPI.pause(id)
        toast('Campaign paused', 'warning')
      } else if (status === 'running') {
        const c = data.find(item => item.id === id)
        if (c?.status === 'paused') {
          await CampaignAPI.resume(id)
          toast('Campaign resumed', 'success')
        } else {
          await CampaignAPI.start(id)
          toast('Campaign started', 'success')
        }
      } else {
        await CampaignAPI.update(id, { status })
        toast(`Status updated to ${status}`, 'info')
      }
      
      // Refresh page data to update KPIs and list
      await loadPageData()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this campaign permanently?')) return

    try {
      await CampaignAPI.remove(id)
      toast('Campaign deleted', 'info')
      await loadPageData()
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  const filteredData = data.filter(c => filter === 'all' || c.status === filter)

  return (
    <PageShell>
      <div className="space-y-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Campaigns
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Real-time outreach dashboard
            </p>
          </div>

          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="h-4 w-4 stroke-[3px]" />
            New Campaign
          </Link>
        </div>

        {/* KPI Strip */}
        {loading ? <SkeletonKPI /> : stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Active Campaigns" value={stats.running_campaigns} icon={<Radio className="h-4 w-4 text-green-600" />} color="green" />
            <StatCard title="Paused" value={stats.paused_campaigns} icon={<PauseCircle className="h-4 w-4 text-amber-600" />} color="amber" />
            <StatCard title="Enrolled Contacts" value={stats.total_contacts} icon={<LayoutGrid className="h-4 w-4 text-indigo-600" />} color="indigo" />
            <StatCard title="Pending in Queue" value={stats.pending_queue} icon={<CheckCircle2 className="h-4 w-4 text-blue-600" />} color="blue" />
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto no-scrollbar">
          <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label="All" count={data.length} />
          <FilterButton active={filter === 'running'} onClick={() => setFilter('running')} label="Running" count={data.filter(c => c.status === 'running').length} />
          <FilterButton active={filter === 'paused'} onClick={() => setFilter('paused')} label="Paused" count={data.filter(c => c.status === 'paused').length} />
          <FilterButton active={filter === 'draft'} onClick={() => setFilter('draft')} label="Draft" count={data.filter(c => c.status === 'draft').length} />
          <FilterButton active={filter === 'completed'} onClick={() => setFilter('completed')} label="Completed" count={data.filter(c => c.status === 'completed').length} />
        </div>

        {/* Table */}
        {loading ? (
          <SkeletonTable rows={6} />
        ) : error ? (
          <ErrorState error={error} />
        ) : data.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <LayoutGrid className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No campaigns yet</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">Create your first campaign to start reaching out to investors.</p>
            <Link
              href="/campaigns/new"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
            >
              Get Started
            </Link>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <CampaignsTable
              campaigns={filteredData}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>
    </PageShell>
  )
}

function FilterButton({ active, label, count, onClick }: { active: boolean, label: string, count: number, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-4 py-2 text-sm font-bold transition-all border-b-2 -mb-px flex items-center gap-2",
        active 
          ? "border-indigo-600 text-indigo-600" 
          : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"
      )}
    >
      {label}
      <span className={clsx(
        "px-1.5 py-0.5 rounded text-[10px] uppercase tracking-tighter",
        active ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
      )}>
        {count}
      </span>
    </button>
  )
}
