import { useState } from 'react'
import { useRouter } from 'next/router'
import { CampaignAPI } from '@/lib/api/campaigns'
import { useToast } from '@/hooks/useToast'

export default function CampaignForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSaving(true)

    try {
      await CampaignAPI.create(form)
      toast('Campaign created successfully', 'success')
      router.push('/campaigns')
    } catch (err: any) {
      toast(`Failed to create campaign: ${err.message}`, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-w-xl"
    >
      <Input
        label="Campaign Name"
        name="name"
        required
        value={form.name}
        onChange={handleChange}
      />

      <Textarea
        label="Description"
        name="description"
        value={form.description}
        onChange={handleChange}
      />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-colors"
        >
          {isSaving ? 'Creating...' : 'Create Campaign'}
        </button>
      </div>
    </form>
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
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
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
        rows={3}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      />
    </div>
  )
}