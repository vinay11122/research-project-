import { useState, useEffect } from 'react'
import Link from 'next/link'
import PageShell from '@/components/layout/PageShell'
import ContactsTable from '@/components/contacts/ContactsTable'
import EditContactDrawer from '@/components/contacts/EditContactDrawer'
import BulkUploadModal from '@/components/contacts/BulkUploadModal'
import { Contact } from '@/types/contact'
import { fetchContacts, updateContact, deleteContact, deleteAllContacts } from '@/lib/api/contacts'
import { ErrorState } from '@/components/ui/AsyncState'
import { SkeletonKPI, SkeletonTable } from '@/components/ui/Skeleton'
import StatCard from '@/components/ui/StatCard'
import { useToast } from '@/hooks/useToast'
import { Users, UserPlus, Upload, Search, ShieldCheck, Mail, Database, Trash2 } from 'lucide-react'

export default function ContactsPage() {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  useEffect(() => {
    loadContacts()
  }, [])

  async function loadContacts() {
    setLoading(true)
    try {
      const data = await fetchContacts()
      setContacts(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredContacts: Contact[] = contacts.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company_name || '').toLowerCase().includes(q)
    )
  })

  async function handleToggleStatus(id: number, value: boolean) {
    try {
      await updateContact(id, { is_active: value })
      setContacts((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, is_active: value } : c
        )
      )
      toast(`Contact ${value ? 'activated' : 'deactivated'}`, 'info')
    } catch (err: any) {
      toast(`Failed to update status: ${err.message}`, 'error')
    }
  }

  async function handleDeleteAll() {
    if (!window.confirm('Are you sure you want to delete ALL contacts? This action cannot be undone.')) {
      return
    }

    try {
      await deleteAllContacts()
      setContacts([])
      toast('All contacts deleted', 'info')
    } catch (err: any) {
      toast(`Failed to delete all contacts: ${err.message}`, 'error')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Are you sure you want to delete this contact?')) {
      return
    }

    try {
      await deleteContact(id)
      setContacts((prev) => prev.filter((c) => c.id !== id))
      toast('Contact deleted', 'info')
    } catch (err: any) {
      toast(`Failed to delete contact: ${err.message}`, 'error')
    }
  }

  return (
    <PageShell>
      <div className="space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <Users className="h-6 w-6 text-indigo-600" />
              Contacts
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Manage your investor network and lead database
            </p>
          </div>
          <div className="flex gap-3">
            {contacts.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 shadow-sm transition-all active:scale-95"
              >
                <Trash2 className="h-4 w-4" />
                Delete All
              </button>
            )}
            <button
              onClick={() => setBulkOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition-all active:scale-95"
            >
              <Upload className="h-4 w-4" />
              Bulk Import
            </button>
            <Link
              href="/contacts/new"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all active:scale-95 hover:-translate-y-0.5"
            >
              <UserPlus className="h-4 w-4 stroke-[3px]" />
              New Contact
            </Link>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Network" value={contacts.length} icon={<Database className="h-4 w-4" />} color="indigo" />
          <StatCard title="Active Contacts" value={contacts.filter(c => c.is_active).length} icon={<ShieldCheck className="h-4 w-4" />} color="green" />
          <StatCard title="Total Reachable" value={contacts.length} icon={<Mail className="h-4 w-4" />} color="blue" />
          <StatCard title="Filtered Results" value={filteredContacts.length} icon={<Search className="h-4 w-4" />} color="slate" />
        </div>

        {/* Search bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-slate-50/50 transition-all"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <SkeletonTable rows={10} />
        ) : error ? (
          <ErrorState error={error} />
        ) : filteredContacts.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No contacts found</h3>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">Try a different search term or add a new contact to your list.</p>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-2 duration-500">
            <ContactsTable
              contacts={filteredContacts}
              onSelect={setSelectedContact}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDelete}
            />
          </div>
        )}

        {/* Drawer */}
        <EditContactDrawer
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onDelete={(id) => {
            handleDelete(id)
            setSelectedContact(null)
          }}
        />

        {/* Modal */}
        <BulkUploadModal
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          onSuccess={() => {
            console.log("ContactsPage: Bulk upload onSuccess triggered.");
            setBulkOpen(false)
            loadContacts()
          }}
        />
      </div>
    </PageShell>
  )
}