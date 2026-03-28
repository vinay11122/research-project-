import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { createContact } from '@/lib/api/contacts'
import { useToast } from '@/hooks/useToast'

const BLOCKED_DOMAINS = [
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "localhost",
  "invalid",
]

export default function ContactForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    company_name: '',
    title: '',
    linkedin_url: '',
    external_id: '',
  })

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (error) setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // 1. Normalize
    const normalizedEmail = form.email.trim().toLowerCase()
    
    // 2. Validate
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    const domain = normalizedEmail.split('@')[1]
    if (BLOCKED_DOMAINS.includes(domain)) {
      setError(`Email domain '${domain}' is not allowed.`)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await createContact({
        ...form,
        email: normalizedEmail,
        full_name: `${form.first_name} ${form.last_name}`.trim(),
        is_active: true
      })
      toast('Contact created successfully', 'success')
      router.push('/contacts')
    } catch (err: any) {
      const msg = err.message || 'Failed to create contact'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-w-xl"
    >
      {error && (
        <div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="First Name"
          name="first_name"
          value={form.first_name}
          onChange={handleChange}
        />
        <Input
          label="Last Name"
          name="last_name"
          value={form.last_name}
          onChange={handleChange}
        />
      </div>

      <Input
        label="Email"
        name="email"
        type="email"
        required
        value={form.email}
        onChange={handleChange}
      />

      <Input
        label="Company"
        name="company_name"
        value={form.company_name}
        onChange={handleChange}
      />

      <Input
        label="Title"
        name="title"
        value={form.title}
        onChange={handleChange}
      />

      <Input
        label="External ID (Unique reference)"
        name="external_id"
        value={form.external_id}
        onChange={handleChange}
        placeholder="e.g. CRM_123"
      />

      <Input
        label="LinkedIn URL"
        name="linkedin_url"
        value={form.linkedin_url}
        onChange={handleChange}
      />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Contact'}
        </button>
      </div>
    </form>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
}

function Input({
  label,
  ...props
}: InputProps) {
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
