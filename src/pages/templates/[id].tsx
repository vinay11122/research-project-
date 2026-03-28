import { useRouter } from 'next/router'
import Link from 'next/link'
import PageShell from '@/components/layout/PageShell'
import { Template } from '@/types/template'
import TemplateEditor from '@/components/templates/TemplateEditor'
import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api/client'
import { Loading, ErrorState } from '@/components/ui/AsyncState'
import { getSafeId } from '@/utils/route'

export default function TemplateDetailPage() {
  const { id } = useRouter().query
  const templateId = getSafeId(id)
  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (templateId === null) return
    loadTemplate(templateId)
  }, [templateId])

  async function loadTemplate(id: number) {
    setLoading(true)
    try {
      const data = await apiFetch<Template>(`/templates/${id}`)
      setTemplate(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <PageShell><Loading /></PageShell>
  if (error) return <PageShell><ErrorState error={error} /></PageShell>
  if (!template || templateId === null) return null

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/templates"
            className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
          >
            <span>&larr;</span> Back to Templates
          </Link>

          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Edit Template
          </h1>
        </div>

        <TemplateEditor template={template} />
      </div>
    </PageShell>
  )
}