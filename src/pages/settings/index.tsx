import PageShell from '@/components/layout/PageShell'
import EmailSettings from '@/components/settings/EmailSettings'
import TrackingSettings from '@/components/settings/TrackingSettings'
import ComplianceSettings from '@/components/settings/ComplianceSettings'

export default function SettingsPage() {
  return (
    <PageShell>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Settings
          </h1>
          <p className="text-sm text-slate-500">
            Configure email sending, tracking, and compliance
          </p>
        </div>

        {/* Email Settings */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-medium text-slate-700 mb-3 uppercase tracking-wider">
            Email Settings
          </h2>
          <EmailSettings />
        </section>

        {/* Tracking */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-medium text-slate-700 mb-3 uppercase tracking-wider">
            Tracking & Webhooks
          </h2>
          <TrackingSettings />
        </section>

        {/* Compliance */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-medium text-slate-700 mb-3 uppercase tracking-wider">
            Unsubscribe & Compliance
          </h2>
          <ComplianceSettings />
        </section>
      </div>
    </PageShell>
  )
}
