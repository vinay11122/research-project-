import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { apiFetch } from '@/lib/api/client'
import { fetchContacts } from '@/lib/api/contacts'
import { fetchCampaigns } from '@/lib/api/campaigns'
import { renderTemplate, createTemplate, updateTemplate } from '@/lib/api/templates'
import { Template, Contact, Campaign } from '@/types'
import VariablePicker from './VariablePicker'
import { useToast } from '@/hooks/useToast'
import { Image as ImageIcon, Video as VideoIcon, Loader2 } from 'lucide-react'

interface Props {
  template?: Template // Optional for new templates
}

export default function TemplateEditor({ template }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const isNew = !template
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const [form, setForm] = useState({
    name: template?.name || '',
    subject_template: template?.subject_template || '',
    body_template: template?.body_template || '',
  })
  
  const [previewActive, setPreviewActive] = useState(false)
  const [previewContactId, setPreviewContactId] = useState<number | null>(null)
  const [previewCampaignId, setPreviewCampaignId] = useState<number | null>(null)
  const [preview, setPreview] = useState<{
    subject: string
    html: string
    text: string
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  
  const [contacts, setContacts] = useState<Contact[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (previewActive) {
      loadPreviewData()
    }
  }, [previewActive])

  async function loadPreviewData() {
    try {
      const [contactsData, campaignsData] = await Promise.all([
        fetchContacts(0, 10),
        fetchCampaigns()
      ])
      setContacts(contactsData)
      setCampaigns(campaignsData)
      
      if (contactsData.length > 0 && !previewContactId) {
        setPreviewContactId(contactsData[0].id)
      }
      if (campaignsData.length > 0 && !previewCampaignId) {
        setPreviewCampaignId(campaignsData[0].id)
      }
    } catch (err) {
      console.error('Failed to load preview data', err)
    }
  }

  async function runPreview() {
    if (!previewContactId || !previewCampaignId) {
      toast('Select a contact and a campaign', 'warning')
      return
    }
    if (isNew) {
      toast('Save the template first to see a live preview', 'info')
      return
    }

    setPreviewLoading(true)
    try {
      const res = await renderTemplate(template!.id, {
        contact_id: previewContactId,
        campaign_id: previewCampaignId, 
      })
      setPreview(res)
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setPreviewLoading(false)
    }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSave() {
    if (!form.name.trim() || !form.subject_template.trim() || !form.body_template.trim()) {
      setError('Please fill in all required fields (Name, Subject, and Body).')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      if (isNew) {
        const res = await createTemplate(form)
        toast('Template created successfully', 'success')
        router.push(`/templates/${res.id}`)
      } else {
        await updateTemplate(template.id, form)
        toast('Template updated successfully', 'success')
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  function insertVariable(value: string) {
    setForm((prev) => ({
      ...prev,
      body_template: prev.body_template + value,
    }))
  }

  function handleImageClick() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const token = localStorage.getItem('token')
      const apiUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://54.90.187.51:8000').replace(/\/$/, '')
      const res = await fetch(`${apiUrl}/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!res.ok) throw new Error('Upload failed')

      const data = await res.json()
      const html = `<br><img src="${data.url}" alt="Image" style="max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0;" /><br>`
      insertVariable(html)
      toast('Image uploaded and inserted', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to upload image', 'error')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function addVideo() {
    const videoUrl = window.prompt('Enter Video Link (where the user goes when clicking):')
    if (!videoUrl) return
    
    // For video thumbnails, we could reuse the file uploader if we wanted to support offline thumbnails too
    // But for now, let's keep the simple URL prompt or ask if they want to upload
    const choice = window.confirm("Do you want to upload a thumbnail image? Click OK to upload, Cancel to enter a URL.")
    
    if (choice) {
      // Create a temporary handler for the file input just for this video insertion
      // Or simplify: Just use URL for now as video hosting usually implies external thumbnails
      // Actually, let's just stick to URL for simplicity or re-use the uploader logic which is complex to decouple
      // Let's go back to simple prompt for now to avoid confusion, or implement a modal later
      const thumbUrl = window.prompt('Enter Thumbnail Image URL:')
      if (thumbUrl) {
         insertVideoHtml(videoUrl, thumbUrl)
      }
    } else {
      const thumbUrl = window.prompt('Enter Thumbnail Image URL:')
      if (thumbUrl) {
         insertVideoHtml(videoUrl, thumbUrl)
      }
    }
  }
  
  function insertVideoHtml(videoUrl: string, thumbUrl: string) {
    const html = `
<br>
<div style="position: relative; display: inline-block; margin: 10px 0;">
  <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: block;">
    <img src="${thumbUrl}" alt="Watch Video" style="display: block; max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e2e8f0;" />
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); color: white; width: 48px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
      <span style="font-size: 16px; line-height: 1;">▶</span>
    </div>
  </a>
</div>
<br>
`
    insertVariable(html)
  }

  return (
    <div className="space-y-4">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*"
        onChange={handleFileChange}
      />

      {/* Toggle Buttons */}
      <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setPreviewActive(false)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              !previewActive
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Edit
          </button>

          <button
            disabled={isNew}
            onClick={() => {
              setPreviewActive(true)
              if (previewContactId) runPreview()
            }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              previewActive
                ? 'bg-indigo-600 text-white shadow-sm'
                : isNew ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Preview
          </button>
        </div>

        {previewActive && (
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold ml-1">Contact</span>
              <select 
                value={previewContactId || ''}
                onChange={(e) => setPreviewContactId(Number(e.target.value))}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select contact</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold ml-1">Campaign</span>
              <select 
                value={previewCampaignId || ''}
                onChange={(e) => setPreviewCampaignId(Number(e.target.value))}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select campaign</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={runPreview}
              disabled={previewLoading || !previewContactId || !previewCampaignId}
              className="mt-4 rounded-md bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
            >
              {previewLoading ? 'Rendering...' : 'Refresh'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {previewActive ? (
        <div className="max-w-4xl space-y-4">
          {preview ? (
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{preview.subject}</p>
              </div>
              <div className="p-6">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Message Body</p>
                <div 
                  className="prose prose-sm max-w-none text-slate-800 bg-slate-50 rounded-md p-4 border border-slate-100 min-h-[300px]"
                  dangerouslySetInnerHTML={{ __html: preview.html }} 
                />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center bg-white">
              <p className="text-slate-500 text-sm">Select a contact and click Refresh to see a live preview.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Editor */}
          <div className="lg:col-span-2 space-y-6 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <Input
              label="Template Name"
              name="name"
              value={form.name}
              onChange={handleChange}
            />

            <Input
              label="Subject Line"
              name="subject_template"
              value={form.subject_template}
              onChange={handleChange}
            />

            <Textarea
              label="Email Body (Markdown/HTML supported)"
              name="body_template"
              value={form.body_template}
              onChange={handleChange}
              rows={15}
            />

            {!form.body_template.includes('{{unsubscribe_url}}') && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 animate-pulse">
                <span className="font-bold">Warning:</span>{' '}
                Your template is missing the{' '}
                <code className="bg-amber-100 px-1 rounded">
                  {'{{unsubscribe_url}}'}
                </code>{' '}
                variable. This is required for legal compliance and to allow the campaign to start.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
               <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3">Insert Media</h3>
               <div className="grid grid-cols-2 gap-2">
                 <button 
                  onClick={handleImageClick}
                  disabled={isUploading}
                  className="flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white hover:border-slate-300 transition-all disabled:opacity-50"
                 >
                   {isUploading ? <Loader2 className="h-4 w-4 animate-spin"/> : <ImageIcon className="h-4 w-4" />}
                   Image
                 </button>
                 <button 
                  onClick={addVideo}
                  className="flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white hover:border-slate-300 transition-all"
                 >
                   <VideoIcon className="h-4 w-4" />
                   Video
                 </button>
               </div>
               <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                 Images are uploaded to your server. Videos must be hosted externally (e.g. YouTube), but we create a beautiful thumbnail card for them.
               </p>
            </div>

            <VariablePicker onInsert={insertVariable} />
            
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
              <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-2">Tips</h4>
              <ul className="text-xs text-indigo-700 space-y-2 list-disc pl-4">
                <li>Use variables to personalize your outreach.</li>
                <li>Make sure to include an unsubscribe link.</li>
                <li>Keep your body clear and concise.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Input({
  label,
  ...props
}: {
  label: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      <input
        {...props}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-shadow"
      />
    </div>
  )
}

function Textarea({
  label,
  ...props
}: {
  label: string
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      <textarea
        {...props}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-shadow"
      />
    </div>
  )
}
