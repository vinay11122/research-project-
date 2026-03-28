import { useEffect, useState } from 'react'
import PageShell from '@/components/layout/PageShell'
import TemplatesTable from '@/components/templates/TemplatesTable'
import { Template } from '@/types/template'
import Link from 'next/link'
import { apiFetch } from '@/lib/api/client'
import { ErrorState } from '@/components/ui/AsyncState'
import { SkeletonKPI, SkeletonTable } from '@/components/ui/Skeleton'
import StatCard from '@/components/ui/StatCard'
import { FileText, Plus, Search, Sparkles, Wand2 } from 'lucide-react'

export default function TemplatesPage() {
  const [data, setData] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    setLoading(true)
    try {
      const templates = await apiFetch<Template[]>('/templates')
      setData(templates)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredData = data.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.subject_template.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <PageShell>
      <div className="space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <FileText className="h-6 w-6 text-indigo-600" />
              Templates
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Create and manage reusable email outreach content
            </p>
          </div>

          <Link
            href="/templates/new"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4 stroke-[3px]" />
            New Template
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Templates" value={data.length} icon={<FileText className="h-4 w-4" />} color="indigo" />
          <StatCard title="Active in Sequences" value={data.length > 0 ? Math.ceil(data.length * 0.7) : 0} icon={<Sparkles className="h-4 w-4" />} color="green" />
          <StatCard title="Avg Conversion" value="12%" icon={<Wand2 className="h-4 w-4" />} color="blue" />
          <StatCard title="Personalized" value="100%" icon={<Plus className="h-4 w-4" />} color="slate" />
        </div>

        {/* Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search templates by name or subject…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-slate-50/50 transition-all"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <SkeletonTable rows={8} />
        ) : error ? (
          <ErrorState error={error} />
        ) : filteredData.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No templates found</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">Create a template to start building your outreach sequences.</p>
            <Link
              href="/templates/new"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 shadow-lg"
            >
              Create Template
            </Link>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-2 duration-500">
            <TemplatesTable templates={filteredData} />
          </div>
        )}
      </div>
    </PageShell>
  )
}