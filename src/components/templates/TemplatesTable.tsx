import Link from 'next/link'
import { Template } from '@/types/template'
import { formatDate } from '@/utils/formatDate'

interface Props {
  templates: Template[]
}

export default function TemplatesTable({ templates }: Props) {
  return (
    <div className="rounded-lg bg-white shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr className="text-left text-slate-500">
            <th className="px-4 py-3 font-medium">Template</th>
            <th className="px-4 py-3 font-medium">Subject</th>
            <th className="px-4 py-3 font-medium">Created</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {templates.map((t) => (
            <tr
              key={t.id}
              className="hover:bg-slate-50 transition-colors"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/templates/${t.id}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {t.name}
                </Link>
              </td>

              <td className="px-4 py-3 text-slate-600">
                {t.subject_template}
              </td>

              <td className="px-4 py-3 text-slate-500">
                {formatDate(t.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}