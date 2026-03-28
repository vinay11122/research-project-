import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/useToast'
import { UserSettings } from '@/types/user'

export default function ComplianceSettings() {
  const { toast } = useToast()
  const [unsubscribeFooterText, setUnsubscribeFooterText] = useState('')
  const [trackingDomain, setTrackingDomain] = useState('')
  const [loading, setLoading] = useState(false)
  
  const unsubscribeUrl = trackingDomain ? `${trackingDomain}/unsubscribe/{token}` : ''

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
            setUnsubscribeFooterText(settings.unsubscribe_footer_text || 'To stop receiving emails, please unsubscribe.')
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
            body: JSON.stringify({ unsubscribe_footer_text: unsubscribeFooterText })
        })

        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.detail || 'Failed to save settings')
        }
        toast('Compliance settings saved successfully', 'success')
    } catch (error: any) {
        toast(error.message, 'error')
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
        <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Unsubscribe Footer Text</label>
            <textarea 
                value={unsubscribeFooterText} 
                onChange={(e) => setUnsubscribeFooterText(e.target.value)} 
                rows={3}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" 
            />
            <p className="mt-1 text-xs text-slate-500">This text will be appended to every email before the unsubscribe link.</p>
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
            {/* Unsubscribe */}
            <div>
                <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                    Unsubscribe URL Structure
                </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                Every email automatically includes a unique unsubscribe link with this structure.
                </p>

                <code className="mt-2 block rounded border border-slate-100 bg-slate-50 p-2 text-[10px] text-indigo-600 overflow-x-auto whitespace-nowrap">
                {unsubscribeUrl}
                </code>
            </div>

            {/* Behavior */}
            <div>
                <span className="text-sm font-medium text-slate-700">
                Unsubscribe Behavior
                </span>
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-600 space-y-1">
                <li>Immediately stops all future emails for the contact.</li>
                <li>Applies across all campaigns for the workspace.</li>
                <li>No login required for unsubscribe.</li>
                </ul>
            </div>
        </div>
    </div>
  )
}
