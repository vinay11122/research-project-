import { useState, useEffect } from 'react'
import { fetchTemplates } from '@/lib/api/templates'
import { fetchContacts } from '@/lib/api/contacts'
import { Template, Contact } from '@/types'
import { apiFetch } from '@/lib/api/client'
import { useToast } from '@/hooks/useToast'

const BLOCKED_DOMAINS = [
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "localhost",
  "invalid",
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function SendTestEmailModal({
  open,
  onClose,
}: Props) {
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [templateId, setTemplateId] = useState<number | ''>('')
  const [contactId, setContactId] = useState<number | ''>('')
  
  const [templates, setTemplates] = useState<Template[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      Promise.all([
        fetchTemplates(),
        fetchContacts(0, 10)
      ])
      .then(([t, c]) => {
        setTemplates(t)
        setContacts(c)
        if (c.length > 0) setContactId(c[0].id)
      })
      .catch(console.error)
    }
  }, [open])

  if (!open) return null

  async function sendTest() {
    const normalizedEmail = email.trim().toLowerCase()
    
    // 1. Basic Validation
    if (!normalizedEmail || !templateId || !contactId) {
      setError('Please fill all fields')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    // 2. Domain Validation
    const domain = normalizedEmail.split('@')[1]
    if (BLOCKED_DOMAINS.includes(domain)) {
      setError(`Email domain '${domain}' is not allowed.`)
      return
    }

    setIsSending(true)
    setError(null)
    try {
      await apiFetch('/email/test-render', {
        method: 'POST',
        body: JSON.stringify({
          template_id: templateId,
          contact_id: contactId,
          to_email: normalizedEmail
        })
      })
      toast('Test email sent successfully via backend!', 'success')
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to send test')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl animate-in fade-in zoom-in duration-200">
        <h3 className="text-lg font-bold mb-4 text-slate-900 uppercase tracking-tight">
          Send Real Test Email
        </h3>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Recipient Email (Real Inbox)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError(null)
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
              placeholder="you@yourcompany.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Select Template
            </label>
            <select
              value={templateId}
              onChange={(e) => {
                setTemplateId(Number(e.target.value))
                if (error) setError(null)
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
            >
              <option value="">Select template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Simulate As Contact
            </label>
            <select
              value={contactId}
              onChange={(e) => {
                setContactId(Number(e.target.value))
                if (error) setError(null)
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
            >
              <option value="">Select contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={sendTest}
            disabled={isSending}
            className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isSending ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Sending...
              </>
            ) : 'Send Test'}
          </button>
        </div>
      </div>
    </div>
  )
}