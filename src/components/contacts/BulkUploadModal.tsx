import { useState, useMemo } from 'react'
import { Database } from 'lucide-react'
import { previewContacts, commitImportJson } from '@/lib/api/imports'
import { X, AlertCircle, CheckCircle, Upload, Save, ArrowLeft, Trash2, Plus } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void // Add this line
}

type ImportRow = {
  _id: string // internal id for keying
  _status: 'valid' | 'invalid'
  _error?: string
  
  first_name: string
  last_name: string
  email: string
  company: string
  linkedin: string
  external_id: string
  exists_in_db?: boolean
  [key: string]: any
}

type SkippedContact = {
  email: string
  external_id?: string
  reason: string
}

export default function BulkUploadModal({ open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<'upload' | 'review' | 'results'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updateExisting, setUpdateExisting] = useState(false)
  const [importResults, setImportResults] = useState<{
    inserted: number,
    updated: number,
    skipped: number,
    errors: string[],
    skipped_contacts: SkippedContact[],
  } | null>(null)

  const hasExistingContacts = useMemo(() => rows.some(r => r.exists_in_db), [rows]);

  if (!open) return null

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const data = await previewContacts(file);
      
      // Process data for editor
      const processed: ImportRow[] = []
      
      // Add valid rows
      data.valid_rows.forEach((r: any, idx: number) => {
        processed.push({
          _id: `valid-${idx}`,
          _status: 'valid',
          ...r,
          company: r.company || r.company_name || '', // normalize
          linkedin: r.linkedin || r.linkedin_url || '',
          external_id: r.external_id || '',
          exists_in_db: r.exists_in_db
        })
      })

      // Add invalid rows
      data.invalid_rows.forEach((r: any, idx: number) => {
        // Data might be in r.data or just missing
        const d = r.data || {}
        processed.push({
          _id: `invalid-${idx}`,
          _status: 'invalid',
          _error: r.error,
          first_name: d.first_name || '',
          last_name: d.last_name || '',
          email: d.email || '',
          company: d.company || d.company_name || '',
          linkedin: d.linkedin || d.linkedin_url || '',
          external_id: d.external_id || '',
          ...d
        })
      })

      // Sort: Invalid first
      processed.sort((a, b) => (a._status === 'invalid' ? -1 : 1))

      setRows(processed)
      setStep('review')
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    console.log("BulkUploadModal: handleCommit started");
    setIsCommitting(true);
    setError(null);
    try {
      // Clean data for submission
      const payload = rows
        .filter(row => row._status === 'valid') // Filter out invalid rows
        .map(({ _id, _status, _error, ...rest }) => ({
          ...rest,
          // Map back to API expected fields if needed
          company_name: rest.company,
          linkedin_url: rest.linkedin,
          external_id: rest.external_id
        }))

      const result = await commitImportJson(payload, updateExisting ? 'update' : 'skip')
      
      setImportResults(result)
      setStep('results')
      console.log("BulkUploadModal: Calling onSuccess()");
      onSuccess()
    } catch (e: any) {
      console.error("BulkUploadModal: handleCommit error", e);
      // Improved error display
      const msg = e.message || "Commit failed";
      setError(msg);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCellChange = (id: string, field: string, value: string) => {
    setRows(prev => prev.map(row => {
      if (row._id !== id) return row
      
      const updatedRow = { ...row, [field]: value };

      // Simple re-validation if it was invalid
      if (updatedRow._status === 'invalid') {
        const hasEmail = updatedRow.email?.trim() && updatedRow.email.includes('@');
        const hasFirstName = updatedRow.first_name?.trim();
        const hasLastName = updatedRow.last_name?.trim();
        const hasCompany = updatedRow.company?.trim();

        if (hasEmail && hasFirstName && hasLastName && hasCompany) {
          updatedRow._status = 'valid';
          updatedRow._error = undefined;
        }
      }

      return updatedRow
    }))
  }

  const handleDeleteRow = (id: string) => {
    setRows(prev => prev.filter(r => r._id !== id))
  }

  const handleAddRow = () => {
    setRows(prev => [
      {
        _id: `new-${Date.now()}`,
        _status: 'valid', // Default to valid so it doesn't look like an error immediately
        first_name: '',
        last_name: '',
        email: '',
        company: '',
        linkedin: '',
        external_id: ''
      },
      ...prev
    ])
  }

  const validCount = rows.filter(r => r._status === 'valid').length
  const invalidCount = rows.filter(r => r._status === 'invalid').length

  const renderContent = () => {
    if (step === 'upload') {
      return (
        <div className="space-y-6">
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center hover:bg-slate-50 hover:border-indigo-300 transition-all cursor-pointer relative group">
            <input
              type="file"
              accept=".csv, .xlsx, .xls, .pdf, .docx"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null)
                setError(null)
              }}
            />
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full group-hover:scale-110 transition-transform">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Click to upload or drag and drop</p>
                <p className="text-sm text-slate-500">CSV, Excel, PDF, or Word</p>
              </div>
            </div>
          </div>

          {file && (
            <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-900">
               <Upload className="h-4 w-4" />
               <span className="font-medium truncate">{file.name}</span>
            </div>
          )}
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}
        </div>
      )
    } else if (step === 'review') {
      return (
        <div className="h-full flex flex-col gap-4">
          {/* Stats Bar */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-md border border-green-100">
              <CheckCircle className="h-4 w-4" />
              <span className="font-bold">{validCount}</span> Valid
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-md border border-red-100">
              <AlertCircle className="h-4 w-4" />
              <span className="font-bold">{invalidCount}</span> Invalid
            </div>
          </div>

          {/* Table Editor */}
          <div className="flex-1 border border-slate-200 rounded-lg overflow-auto">
            <table className="w-full text-sm text-left relative">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">First Name</th>
                  <th className="px-4 py-3 font-medium">Last Name</th>
                  <th className="px-4 py-3 font-medium w-64">Email</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">LinkedIn</th>
                  <th className="px-4 py-3 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row._id} className={`group hover:bg-slate-50 transition-colors ${row._status === 'invalid' ? 'bg-red-50/30' : row.exists_in_db ? 'bg-blue-50/30' : ''}`}>
                     <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                       {row._status === 'valid' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                       ) : (
                         <div className="group/tooltip relative">
                           <AlertCircle className="h-4 w-4 text-red-500 cursor-help" />
                           <div className="absolute left-6 top-0 w-48 p-2 bg-red-800 text-white text-xs rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none z-50">
                             {row._error}
                           </div>
                         </div>
                       )}
                       {row.exists_in_db && (
                          <div className="group/tooltip relative">
                            <Database className="h-4 w-4 text-blue-500 cursor-help" />
                            <div className="absolute left-6 top-0 w-48 p-2 bg-blue-800 text-white text-xs rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none z-50">
                              This contact already exists in your database. If you proceed with "Update existing contacts" checked, its information will be updated.
                            </div>
                          </div>
                       )}
                      </div>
                     </td>
                     <td className="p-1">
                       <input 
                         value={row.first_name} 
                         onChange={e => handleCellChange(row._id, 'first_name', e.target.value)}
                         className="w-full px-2 py-1.5 rounded border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent"
                       />
                     </td>
                     <td className="p-1">
                       <input 
                         value={row.last_name} 
                         onChange={e => handleCellChange(row._id, 'last_name', e.target.value)}
                         className="w-full px-2 py-1.5 rounded border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent"
                       />
                     </td>
                     <td className="p-1">
                       <input 
                         value={row.email} 
                         onChange={e => handleCellChange(row._id, 'email', e.target.value)}
                         className={`w-full px-2 py-1.5 rounded border ${row._status === 'invalid' && (typeof row.email === 'string' && row.email.includes('@') === false) ? 'border-red-300 bg-red-50' : 'border-transparent hover:border-slate-300'} focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent`}
                       />
                     </td>
                     <td className="p-1">
                       <input 
                         value={row.company} 
                         onChange={e => handleCellChange(row._id, 'company', e.target.value)}
                         className="w-full px-2 py-1.5 rounded border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent"
                       />
                     </td>
                     <td className="p-1">
                       <input 
                         value={row.linkedin} 
                         onChange={e => handleCellChange(row._id, 'linkedin', e.target.value)}
                         className="w-full px-2 py-1.5 rounded border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-transparent"
                       />
                     </td>
                     <td className="p-1">
                       <button
                         onClick={() => handleDeleteRow(row._id)}
                         className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                         title="Delete row"
                       >
                         <Trash2 className="h-4 w-4" />
                       </button>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    } else if (step === 'results' && importResults) {
      const { inserted, updated, skipped, errors, skipped_contacts } = importResults
      return (
        <div className="h-full flex flex-col gap-4">
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-md border border-green-100">
              <CheckCircle className="h-4 w-4" />
              Inserted: {inserted}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
              <Database className="h-4 w-4" />
              Updated: {updated}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-md border border-yellow-100">
              <AlertCircle className="h-4 w-4" />
              Skipped: {skipped}
            </div>
          </div>

          {errors.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="h-5 w-5 shrink-0" />
                Errors during import:
              </div>
              <ul className="list-disc pl-5">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {skipped_contacts.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-800 flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="h-5 w-5 shrink-0" />
                Skipped Contacts:
              </div>
              <ul className="list-disc pl-5">
                {skipped_contacts.map((contact, i) => (
                  <li key={i}>
                    {contact.email} {contact.external_id ? `(External ID: ${contact.external_id})` : ''} - {contact.reason.replace(/_/g, ' ')}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full ${step === 'review' ? 'max-w-6xl h-[80vh]' : 'max-w-md'} flex flex-col rounded-xl bg-white shadow-2xl transition-all duration-300`}>
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {step === 'upload' ? 'Import Contacts' : step === 'review' ? 'Review & Fix Data' : 'Import Results'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {step === 'upload' 
                ? 'Upload a CSV or Excel file to begin' 
                : step === 'review'
                  ? `Found ${rows.length} rows (${invalidCount} need attention)`
                  : 'Import process completed.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-6 flex justify-between bg-slate-50 rounded-b-xl">
          {step === 'review' ? (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setStep('upload')
                  setRows([])
                }}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium px-2 py-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Re-upload
              </button>
              <button
                onClick={handleAddRow}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg text-sm font-medium px-3 py-2 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Row
              </button>
            </div>
          ) : step === 'results' ? (
            <div /> // No actions after results, or add a "Done" button
          ) : (
            <div />
          )}

          <div className="flex gap-3 items-center">
            {step === 'review' && (
              <label className={`flex items-center gap-2 text-sm text-slate-700 font-medium mr-2 ${hasExistingContacts ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <input 
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  disabled={!hasExistingContacts}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                Update existing contacts
              </label>
            )}

            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-white bg-white shadow-sm"
            >
              Cancel
            </button>

            {step === 'upload' ? (
              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-100 transition-all active:scale-95"
              >
                {loading ? "Processing..." : "Preview Import"}
              </button>
            ) : step === 'review' ? (
              <button
                onClick={handleCommit}
                disabled={isCommitting}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-green-100 transition-all active:scale-95"
              >
                <Save className="h-4 w-4" />
                {isCommitting ? "Importing..." : `Import ${validCount} Contacts`}
              </button>
            ) : (
              <button
                onClick={onClose} // After results, close the modal
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-700 shadow-md shadow-indigo-100 transition-all active:95"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
