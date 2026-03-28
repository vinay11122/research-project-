import PageShell from '@/components/layout/PageShell'
import CampaignForm from '@/components/campaigns/CampaignForm'
import Link from 'next/link'

export default function NewCampaignPage() {
  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/campaigns"
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Back to Campaigns
          </Link>

          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            New Campaign
          </h1>
          <p className="text-sm text-slate-500">
            Create a new outreach campaign
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <CampaignForm />
        </div>
      </div>
    </PageShell>
  )
}
