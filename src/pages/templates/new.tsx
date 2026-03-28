import PageShell from '@/components/layout/PageShell'
import TemplateEditor from '@/components/templates/TemplateEditor'
import Link from 'next/link'

export default function NewTemplatePage() {
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
            Create New Template
          </h1>
        </div>

        <TemplateEditor />
      </div>
    </PageShell>
  )
}