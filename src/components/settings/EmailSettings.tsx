import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/useToast'
import { UserSettings } from '@/types/user' // We'll need a new type for settings

export default function EmailSettings() {
  const { toast } = useToast()

  // Form State
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState<number | ''>('')
  const [smtpUsername, setSmtpUsername] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [loading, setLoading] = useState(false)

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
            setSmtpHost(settings.smtp_host || '')
            setSmtpPort(settings.smtp_port || '')
            setSmtpUsername(settings.smtp_username || '')
            setFromName(settings.from_name || '')
            setFromEmail(settings.from_email || '')
            setReplyTo(settings.reply_to_email || '')
        } catch (error: any) {
            toast(error.message, 'error')
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

    const settingsToSave: Partial<UserSettings> = {
        smtp_host: smtpHost,
        smtp_port: smtpPort === '' ? undefined : Number(smtpPort),
        smtp_username: smtpUsername,
        from_name: fromName,
        from_email: fromEmail,
        reply_to_email: replyTo,
    }
    // Only include password if user has entered a new one
    if (smtpPassword) {
        settingsToSave.smtp_password = smtpPassword
    }

    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://54.90.187.51:8000'}/settings`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(settingsToSave)
        })

        if (!res.ok) {
            const data = await res.json()
            throw new Error(data.detail || 'Failed to save settings')
        }
        toast('Email settings saved successfully', 'success')
        setSmtpPassword('') // Clear password field after save
    } catch (error: any) {
        toast(error.message, 'error')
    } finally {
        setLoading(false)
    }
  }

  function sendTestEmail() {
    if (!testEmail) {
      toast('Enter test email address', 'warning')
      return
    }
    // This functionality will need to be implemented on the backend
    console.log('Sending test email (mock)', { testEmail })
    toast('Test email sent (mock)', 'info')
  }

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">SMTP Host</label>
                <input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">SMTP Port</label>
                <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value === '' ? '' : parseInt(e.target.value, 10))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">SMTP Username</label>
                <input value={smtpUsername} onChange={(e) => setSmtpUsername(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">SMTP Password</label>
                <input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} placeholder="Enter new password to update" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">From Name</label>
                <input value={fromName} onChange={(e) => setFromName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">From Email</label>
                <input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Reply-To Email</label>
                <input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
            </div>
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

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Send Test Email
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="test@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
          <button
            onClick={sendTestEmail}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm"
          >
            Send Test
          </button>
        </div>
      </div>
    </div>
  )
}