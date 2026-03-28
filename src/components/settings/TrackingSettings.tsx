import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/useToast'
import { UserSettings } from '@/types/user'

export default function TrackingSettings() {
  const { toast } = useToast()
  const [trackingDomain, setTrackingDomain] = useState('')
  const [loading, setLoading] = useState(false)

  const inboundWebhook = trackingDomain ? `${trackingDomain}/email/webhook/inbound` : ''
  const clickTracking = trackingDomain ? `${trackingDomain}/track/click/{email_id}/{link_id}` : ''
  const openTracking = trackingDomain ? `${trackingDomain}/track/open/{email_id}.png` : ''

  useEffect(() => {
    async function fetchSettings() {
        const token = localStorage.getItem('token')
        if (!token) return
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://54.90.187.51:8000'}/settings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) throw new Error("Failed to fetch settings")
            
            const settings: UserSettings = await res.json()
            setTrackingDomain(settings.tracking_domain || window.location.origin)
        } catch (error: any) {
            toast(error.message, 'error')
            setTrackingDomain(window.location.origin) // Fallback
        }
    }
    fetchSettings()
  }, [toast])

  async function saveSettings() {
    setLoading(true)
    const token = localStorage.getItem('token')
    if (!token) {
        toast('Authentication error', 'error')
        setLoading(false)
        return
    }

    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://54.90.187.51:8000'}/settings`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ tracking_domain: trackingDomain })
        })

        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.detail || 'Failed to save settings')
        }
        toast('Tracking settings saved successfully', 'success')
    } catch (error: any) {
        toast(error.message, 'error')
    } finally {
        setLoading(false)
    }
  }


  return (
    <div className="space-y-6">
        <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Custom Tracking Domain</label>
            <input value={trackingDomain} onChange={(e) => setTrackingDomain(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
            <p className="mt-1 text-xs text-slate-500">The domain used to generate tracking links and webhooks. Defaults to this application's domain.</p>
        </div>

        <div className="flex gap-3">
            <button
            onClick={saveSettings}
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
            >
            {loading ? 'Saving...' : 'Save Settings'}
            </button>
        </div>

        <hr className="border-slate-100" />
      
        <div className="space-y-5">
            {/* Open Tracking */}
            <div>
                <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                    Open Tracking
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider rounded-full bg-green-100 text-green-700 px-2 py-0.5 border border-green-200">
                    Enabled
                </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                Uses a 1×1 tracking pixel embedded in emails.
                </p>
                <code className="mt-2 block rounded border border-slate-100 bg-slate-50 p-2 text-[10px] text-indigo-600 overflow-x-auto whitespace-nowrap">
                {openTracking}
                </code>
            </div>

            {/* Click Tracking */}
            <div>
                <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                    Click Tracking
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider rounded-full bg-green-100 text-green-700 px-2 py-0.5 border border-green-200">
                    Enabled
                </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                All links are wrapped to record clicks before redirect.
                </p>
                <code className="mt-2 block rounded border border-slate-100 bg-slate-50 p-2 text-[10px] text-indigo-600 overflow-x-auto whitespace-nowrap">
                {clickTracking}
                </code>
            </div>

            {/* Inbound Webhook */}
            <div>
                <span className="text-sm font-medium text-slate-700">
                Inbound Email Webhook
                </span>
                <p className="mt-1 text-sm text-slate-500">
                Used by your inbound email provider to notify replies.
                </p>
                <code className="mt-2 block rounded border border-slate-100 bg-slate-50 p-2 text-[10px] text-indigo-600 overflow-x-auto whitespace-nowrap">
                {inboundWebhook}
                </code>
            </div>
        </div>
    </div>
  )
}
