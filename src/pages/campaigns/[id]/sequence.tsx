import { useRouter } from 'next/router'
import Link from 'next/link'
import PageShell from '@/components/layout/PageShell'
import CampaignTabs from '@/components/campaigns/CampaignTabs'
import SequenceBuilder from '@/components/campaigns/SequenceBuilder'
import SendTestEmailModal from '@/components/email/SendTestEmailModal'
import { CampaignAPI } from '@/lib/api/campaigns'
import { fetchCampaignSequence } from '@/lib/api/sequence'
import { Campaign } from '@/types/campaign'
import { SequenceStep } from '@/types/sequence'
import { useState, useEffect } from 'react'
import { ErrorState } from '@/components/ui/AsyncState'
import { SkeletonKPI, SkeletonTable } from '@/components/ui/Skeleton'
import { getSafeId } from '@/utils/route'
import { Mail, FlaskConical, Settings2, Info, ChevronRight } from 'lucide-react'
import CampaignStatusBadge from '@/components/campaigns/CampaignStatusBadge'

export default function CampaignSequencePage() {
  const router = useRouter()
  const campaignId = getSafeId(router.query.id)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [steps, setSteps] = useState<SequenceStep[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openTestModal, setOpenTestModal] = useState(false)

  useEffect(() => {
    if (campaignId === null) return
    loadData(campaignId)
  }, [campaignId])

  async function loadData(id: number) {
    setLoading(true)
    try {
      const [campaignData, sequenceData] = await Promise.all([
        CampaignAPI.get(id),
        fetchCampaignSequence(id)
      ])
      setCampaign(campaignData)
      setSteps(sequenceData.steps || [])
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
          <div className="h-16 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          <SkeletonTable rows={3} />
        </div>
      </PageShell>
    )
  }

  if (error) return <PageShell><ErrorState error={error} /></PageShell>
  if (!campaign || campaignId === null) return null

  return (
    <PageShell>
      <div className="space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
        {/* Campaign Header Summary */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <Settings2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                {campaign.name}
                <CampaignStatusBadge status={campaign.status} />
              </h1>
              <p className="text-sm text-slate-500 font-medium">Sequence Editor & Automation Flow</p>
            </div>
          </div>

          <button
            onClick={() => setOpenTestModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
          >
            <FlaskConical className="h-4 w-4 text-indigo-600" />
            Send Test Email
          </button>
        </div>

        <CampaignTabs campaignId={String(campaignId)} status={campaign.status} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <SequenceBuilder 
              campaignId={campaignId} 
              initialSteps={steps} 
              onSave={() => loadData(campaignId)}
            />
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Info className="h-3.5 w-3.5" />
                Automation Rules
              </h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</div>
                  <p className="text-xs text-slate-600 leading-relaxed">Sequence stops automatically when a contact <b>replies</b>.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</div>
                  <p className="text-xs text-slate-600 leading-relaxed">Safety mode is active: emails are throttled to <b>1 every 2 seconds</b>.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</div>
                  <p className="text-xs text-slate-600 leading-relaxed">Tracking links are injected into every outgoing message.</p>
                </li>
              </ul>
            </div>

            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-200">
              <Mail className="h-8 w-8 text-indigo-400 mb-4" />
              <h4 className="text-sm font-bold mb-2 tracking-tight">Need help with Copy?</h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">Check our library of high-converting investor outreach templates in the main Template section.</p>
              <Link href="/templates" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                Browse Library <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        <SendTestEmailModal
          open={openTestModal}
          onClose={() => setOpenTestModal(false)}
        />
      </div>
    </PageShell>
  )
}
