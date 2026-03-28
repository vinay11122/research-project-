import { Contact } from '@/types/contact'
import { useToast } from '@/hooks/useToast'

interface Props {
  contact: Contact | null
  onClose: () => void
  onDelete?: (id: number) => void
}

export default function EditContactDrawer({ contact, onClose, onDelete }: Props) {
  const { toast } = useToast()
  if (!contact) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div
        className="flex-1 bg-black/30"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="w-full max-w-md bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">
          Edit Contact
        </h2>

        <div className="mt-4 space-y-4">
          <Input label="First Name" defaultValue={contact.first_name} />
          <Input label="Last Name" defaultValue={contact.last_name} />
          <Input label="Email" defaultValue={contact.email} />
          <Input label="Company" defaultValue={contact.company_name} />
          <Input label="Title" defaultValue={contact.title} />
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => {
              toast('Contact updated (mock)', 'info')
              onClose()
            }}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition-colors"
          >
            Save Changes
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onDelete?.(contact.id)}
              className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
            >
              Delete
            </button>

            <button
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Input({
  label,
  defaultValue,
}: {
  label: string
  defaultValue?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      <input
        defaultValue={defaultValue}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      />
    </div>
  )
}