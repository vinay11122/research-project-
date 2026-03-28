import { useRouter } from 'next/router'
import PageShell from '@/components/layout/PageShell'
import { CampaignAPI } from '@/lib/api/campaigns'
import { Campaign } from '@/types/campaign'
import CampaignTabs from '@/components/campaigns/CampaignTabs'
import CampaignStatusBadge from '@/components/campaigns/CampaignStatusBadge'
import { useState, useEffect } from 'react'
import { Loading, ErrorState } from '@/components/ui/AsyncState'
import { apiFetch } from '@/lib/api/client'
import { getSafeId } from '@/utils/route'
import { formatUTC, parseDatetimeLocalAsUTC } from '@/utils/formatDate'
import { useToast } from '@/hooks/useToast'
import { 
  Play, 
  Pause, 
  Trash2, 
  Settings2, 
  AlertCircle, 
  Calendar,
  Clock,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react'

export default function CampaignOverviewPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { id } = router.query
  const campaignId = getSafeId(id)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [editMode, setEditMode] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  
  // Schedule state
  const [startAtLocal, setStartAtLocal] = useState('')

  const [validationIssues, setValidationIssues] = useState<string[]>([])

  useEffect(() => {
    if (campaignId === null) return
    loadCampaign(campaignId)
  }, [campaignId])

  async function loadCampaign(id: number) {
    setLoading(true)
    try {
      const data = await CampaignAPI.get(id)
      setCampaign(data)
      setName(data.name)
      setDescription(data.description || '')
      
      if (data.start_at) {
        setStartAtLocal(toDateTimeLocal(data.start_at))
      } else {
        setStartAtLocal('')
      }
      
      if (data.status === 'draft' || data.status === 'validated') {
        runValidation(id, false)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function toDateTimeLocal(isoString: string) {
    if (!isoString) return "";
    const d = new Date(isoString);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }

  async function runValidation(id: number, showAlert = true) {
    try {
      const v = await apiFetch<{ is_valid: boolean, issues: string[], new_status: string }>(`/campaigns/${id}/validate`, { method: 'POST' })
      setValidationIssues(v.issues)
      if (campaign) setCampaign({ ...campaign, status: v.new_status as any })
      if (showAlert && v.is_valid) toast('Campaign validated successfully!', 'success')
    } catch (err: any) {
      if (showAlert) toast(`Validation failed: ${err.message}`, 'error')
    }
  }

  async function handleUpdate() {
    if (campaignId === null || !campaign) return
    setIsProcessing(true)
    try {
      const updated = await CampaignAPI.update(campaign.id, { name, description })
      setCampaign(updated)
      setEditMode(false)
      toast('Campaign details updated', 'success')
      runValidation(campaignId, false)
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleScheduleSave() {
    if (campaignId === null || !campaign) return;
    setIsProcessing(true);
    try {
      const iso = startAtLocal ? parseDatetimeLocalAsUTC(startAtLocal) : null;
      const updated = await apiFetch<Campaign>(`/campaigns/${campaign.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ start_at: iso })
      });
      setCampaign(updated);
      setStartAtLocal(updated.start_at ? toDateTimeLocal(updated.start_at) : '');
      toast(iso ? 'Schedule saved' : 'Schedule cleared', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleStart() {
    if (campaignId === null || !campaign) return
    setIsProcessing(true)
    try {
      await CampaignAPI.start(campaign.id)
      const refreshed = await CampaignAPI.get(campaign.id)
      setCampaign(refreshed)
      const isFuture = refreshed.start_at && new Date(refreshed.start_at).getTime() > Date.now();
      toast(isFuture ? 'Campaign scheduled!' : 'Campaign started successfully!', 'success')
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handlePause() {
    if (campaignId === null || !campaign) return
    setIsProcessing(true)
    try {
      const res = await apiFetch<{ new_status: string }>(`/campaigns/${campaignId}/pause`, { method: 'POST' })
      setCampaign({ ...campaign, status: res.new_status as any })
      toast('Campaign paused', 'warning')
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleResume() {
    if (!campaign) return
    setIsProcessing(true)
    try {
      const res = await apiFetch<{ new_status: string }>(`/campaigns/${campaignId}/resume`, { method: 'POST' })
      await CampaignAPI.patch(campaign.id, { limit_reset_at: null })
      setCampaign({ ...campaign, status: res.new_status as any, limit_reset_at: null })
      toast('Campaign resumed', 'success')
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleDelete() {
    if (!campaign) return
    if (!window.confirm('Delete this campaign? This cannot be undone.')) return

    setIsProcessing(true)
    try {
      await CampaignAPI.remove(campaign.id)
      toast('Campaign deleted permanently', 'info')
      router.push('/campaigns')
    } catch (err: any) {
      toast(err.message, 'error')
      setIsProcessing(false)
    }
  }

  if (loading) return <PageShell><Loading /></PageShell>
  if (error) return <PageShell><ErrorState error={error} /></PageShell>
  if (!campaign || campaignId === null) return null

  const status = campaign.status

  return (
    <PageShell>
      <div className="space-y-8 max-w-[1400px] mx-auto">
        {/* Sticky Control Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm sticky top-20 z-30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              {editMode ? (
                <div className="space-y-3 max-w-xl animate-in fade-in slide-in-from-left-2 duration-300">
                  <input 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="block w-full text-2xl font-bold text-slate-900 border-b-2 border-indigo-100 focus:outline-none focus:border-indigo-500 bg-transparent"
                  />
                  <textarea 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="block w-full text-sm text-slate-500 border-b border-slate-100 focus:outline-none focus:border-indigo-500 bg-transparent"
                    rows={1}
                  />
                  <div className="flex gap-2">
                    <button onClick={handleUpdate} disabled={isProcessing} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700 transition-all">Save</button>
                    <button onClick={() => { setEditMode(false); setName(campaign.name); setDescription(campaign.description || ''); }} className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-900 truncate flex items-center gap-3">
                      {campaign.name}
                      <CampaignStatusBadge status={status} />
                    </h1>
                    {campaign.description ? (
                      <p className="mt-1 text-sm text-slate-500 font-medium line-clamp-1 italic">
                        {campaign.description}
                      </p>
                    ) : (
                      <button onClick={() => setEditMode(true)} className="mt-1 text-xs text-indigo-600 font-bold hover:underline">Add description</button>
                    )}
                  </div>
                  <button onClick={() => setEditMode(true)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                    <Settings2 className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {status === 'validated' && (
                <button onClick={handleStart} disabled={isProcessing} className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                  <Play className="h-4 w-4 fill-current" /> Start Campaign
                </button>
              )}
              {status === 'running' && (
                <button onClick={handlePause} disabled={isProcessing} className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white hover:bg-amber-600 shadow-lg shadow-amber-200 transition-all active:scale-95">
                  <Pause className="h-4 w-4 fill-current" /> Pause
                </button>
              )}
              {status === 'paused' && (
                <button onClick={handleResume} disabled={isProcessing} className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-sm font-bold text-white hover:bg-green-700 shadow-lg shadow-green-200 transition-all active:scale-95">
                  <Play className="h-4 w-4 fill-current" /> Resume
                </button>
              )}
              <button onClick={handleDelete} disabled={isProcessing} className="p-3 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 transition-all active:scale-95">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <CampaignTabs campaignId={String(campaignId)} status={status} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Rate Limit Alert */}
            {campaign.limit_reset_at && new Date(campaign.limit_reset_at).getTime() > Date.now() && (
              <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 flex items-start gap-4 animate-in zoom-in duration-300">
                <div className="bg-amber-500 p-2 rounded-xl text-white">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-amber-900 mb-1 tracking-tight">Provider Rate Limit Reached</h4>
                  <p className="text-sm text-amber-800 leading-relaxed opacity-80">
                    Your SMTP provider has limited your daily sends. To protect your domain reputation, the campaign is temporarily held.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-xs font-bold text-amber-700 shadow-sm">
                    <Clock className="h-3.5 w-3.5" />
                    Available again after: {formatUTC(campaign.limit_reset_at)}
                  </div>
                </div>
              </div>
            )}

            {/* Validation Issues */}
            {(status === 'draft' || status === 'validated') && validationIssues.length > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
                <div className="flex items-center gap-2 text-red-800 mb-4 font-bold">
                  <AlertCircle className="h-5 w-5" />
                  <span className="uppercase tracking-widest text-xs">Pre-flight Checklist</span>
                </div>
                <ul className="space-y-3">
                  {validationIssues.map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-red-700 bg-white/50 p-3 rounded-xl border border-red-100 shadow-sm">
                      <span className="h-5 w-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick Summary Cards */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Campaign Strategy</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase">Target Audience</p>
                  <p className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    {/* Placeholder for real enrolled count if we pass it in overview */}
                    Multiple Investors
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-tighter">Verified</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase">Sending Speed</p>
                  <p className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    Safety Mode
                    <span className="text-xs text-slate-400 font-medium tracking-tight">1 email / 2 seconds</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Scheduling Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900 mb-6 font-bold">
                <Calendar className="h-5 w-5 text-indigo-600" />
                Scheduler
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Start Time (UTC)</label>
                  <input
                    type="datetime-local"
                    value={startAtLocal}
                    onChange={(e) => setStartAtLocal(e.target.value)}
                    disabled={status === 'completed'}
                    className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-slate-50 transition-all font-mono"
                  />
                </div>
                
                <button
                  onClick={handleScheduleSave}
                  disabled={isProcessing || status === 'completed'}
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 shadow-md shadow-slate-200 transition-all disabled:opacity-50"
                >
                  Save Schedule
                </button>

                {campaign.start_at && (
                  <div className="pt-4 border-t border-slate-100 flex items-start gap-3 animate-in fade-in duration-500">
                    <Clock className="h-4 w-4 text-indigo-500 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Configured UTC</p>
                      <p className="text-xs font-mono text-slate-700 font-bold tracking-tight">
                        {formatUTC(campaign.start_at)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Repuational Tip */}
            <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldCheck className="h-20 w-20 rotate-12" />
              </div>
              <h4 className="text-sm font-bold uppercase tracking-widest mb-2 opacity-60">Reputation Tip</h4>
              <p className="text-sm leading-relaxed font-medium">
                Include personal variables in every sequence step to maintain high deliverability and avoid spam filters.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}