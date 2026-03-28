import { Contact } from '@/types/contact'
import clsx from 'clsx'
import Toggle from '@/components/ui/Toggle'
import { formatDate } from '@/utils/formatDate'

interface Props {
  contacts: Contact[]
  onSelect?: (contact: Contact) => void
  onToggleStatus?: (id: number, value: boolean) => void
  onDelete?: (id: number) => void
}

export default function ContactsTable({ contacts, onSelect, onToggleStatus, onDelete }: Props) {
  return (
    <div className="rounded-lg bg-white shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr className="text-left text-slate-500">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Company</th>
            <th className="px-4 py-3 font-medium text-center">Active</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {contacts.map((c) => (
            <tr
              key={c.id}
              onClick={() => onSelect?.(c)}
              className="hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <td className="px-4 py-3 font-medium text-slate-900">
                {c.full_name}
              </td>
              <td className="px-4 py-3 text-slate-700">
                {c.email}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {c.company_name || '-'}
              </td>
              <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                <Toggle
                  enabled={c.is_active}
                  onChange={(value) =>
                    onToggleStatus?.(c.id, value)
                  }
                />
              </td>
              <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                {formatDate(c.created_at)}
              </td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onDelete?.(c.id)}
                  className="text-red-600 hover:text-red-800 text-xs font-medium"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}