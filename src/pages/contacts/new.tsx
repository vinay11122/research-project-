import PageShell from '@/components/layout/PageShell'
import ContactForm from '@/components/contacts/ContactForm'
import Link from 'next/link'

export default function NewContactPage() {
  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/contacts"
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Back to Contacts
          </Link>

          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            New Contact
          </h1>
          <p className="text-sm text-slate-500">
            Add a new investor or outreach contact
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <ContactForm />
        </div>
      </div>
    </PageShell>
  )
}
