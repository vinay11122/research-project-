import { useState, useEffect } from "react";
import { commitImportJson } from "@/lib/api/imports";
import { useRouter } from "next/router";
import { AlertCircle, CheckCircle, Trash2, Info } from "lucide-react";

export default function ImportPreview({ preview }: { preview: any }) {
  const router = useRouter();
  const [contacts, setContacts] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync state when preview changes
  useEffect(() => {
    if (preview) {
      const allRows = [
        ...(preview.valid_rows || []).map((r: any) => ({ ...r, _status: 'valid' })),
        ...(preview.invalid_rows || []).map((r: any) => ({ 
          ...(r.data || {}), 
          _status: 'invalid', 
          _error: r.error,
          _row: r.row 
        }))
      ];
      setContacts(allRows);
    }
  }, [preview]);

  if (!preview) return null;

      const handleFieldChange = (index: number, field: string, value: string) => {
      const updated = [...contacts];
      
      // Directly use 'company_name'
      updated[index] = { ...updated[index], [field]: value };
      
      // Simple re-validation: if it was invalid due to missing fields, check if they are now present
      if (updated[index]._status === 'invalid') {
        const req = ['email', 'first_name', 'last_name'];
        const missing = req.filter(f => !updated[index][f]?.trim());
        const isValidEmailFormat = updated[index].email?.includes('@');

        if (missing.length === 0 && isValidEmailFormat) {
          updated[index]._status = 'valid';
          updated[index]._error = null;
        } else {
            let errorMessages = [];
            if (!isValidEmailFormat) {
                errorMessages.push("Invalid email format.");
            }
            if (missing.length > 0) {
                errorMessages.push(`Missing: ${missing.join(', ')}.`);
            }
            updated[index]._error = errorMessages.join(" ");
            updated[index]._status = 'invalid'; // Ensure status remains invalid if still errors
        }
      }
      
      setContacts(updated);
    };
  const handleRemove = (index: number) => {
    const updated = [...contacts];
    updated.splice(index, 1);
    setContacts(updated);
  };

      const handleCommit = async () => {
      // Only commit rows that are now 'valid'
      const toImport = contacts
        .filter(c => c._status === 'valid') // Only commit valid rows
        .map(c => ({
          ...c,
          // Ensure company_name is always set, and no 'company' field is passed
          company_name: c.company_name, 
        }));
  
    if (toImport.length === 0) {
      setError("No valid contacts to import. Please fix errors first.");
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const res = await commitImportJson(toImport, "skip");
      setSuccess(`Successfully imported ${res.inserted} contacts (Skipped: ${res.skipped}, Updated: ${res.updated})`);
      setTimeout(() => router.push("/contacts"), 2000);
    } catch (err: any) {
      setError(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const validCount = contacts.filter(c => c._status === 'valid').length;
  const invalidCount = contacts.filter(c => c._status === 'invalid').length;
  const [updateExisting, setUpdateExisting] = useState(false);
  const hasExistingContacts = contacts.some(r => r.exists_in_db);

  return (
    <div className="border rounded-xl p-6 mt-6 space-y-6 bg-white shadow-md animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
            <h3 className="text-xl font-bold text-slate-900">Import Review & Edit</h3>
            <p className="text-sm text-slate-500">Fix errors and verify data before final import</p>
        </div>
        <div className="flex gap-4">
           <div className="text-center px-3 py-1 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total</div>
                <div className="text-lg font-bold text-slate-700">{contacts.length}</div>
           </div>
           <div className="text-center px-3 py-1 bg-green-50 rounded-lg border border-green-100">
                <div className="text-xs text-green-500 font-bold uppercase tracking-wider">Ready</div>
                <div className="text-lg font-bold text-green-600">{validCount}</div>
           </div>
           <div className="text-center px-3 py-1 bg-red-50 rounded-lg border border-red-100">
                <div className="text-xs text-red-500 font-bold uppercase tracking-wider">Issues</div>
                <div className="text-lg font-bold text-red-600">{invalidCount}</div>
           </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 text-red-700 p-4 rounded-xl border border-red-200">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-green-50 text-green-700 p-4 rounded-xl border border-green-200">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {/* EDITABLE TABLE */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-inner bg-slate-50/30">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status / Row</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">First Name</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Name</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company Name</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {contacts.map((contact, idx) => (
              <tr key={idx} className={contact._status === 'invalid' ? 'bg-red-50/30' : ''}>
                <td className="px-4 py-3 whitespace-nowrap">
                  {contact._status === 'valid' ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase">Ready</span>
                    </div>
                  ) : (
                    <div className="flex flex-col group relative">
                      <div className="flex items-center gap-2 text-red-600 cursor-help">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-tight">Fix Me (Row {contact._row})</span>
                      </div>
                      {contact._error && (
                        <div className="hidden group-hover:block absolute left-0 top-6 z-20 w-48 bg-slate-900 text-white text-[10px] p-2 rounded shadow-xl">
                            {contact._error}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <input 
                    className={`w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 focus:ring-0 text-sm py-1 px-1 transition-all ${!contact.email ? 'bg-red-50 border-red-200' : ''}`}
                    value={contact.email || ""} 
                    placeholder="Email required"
                    onChange={(e) => handleFieldChange(idx, "email", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input 
                    className={`w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 focus:ring-0 text-sm py-1 px-1 transition-all ${!contact.first_name ? 'bg-red-50 border-red-200' : ''}`}
                    value={contact.first_name || ""} 
                    placeholder="First Name"
                    onChange={(e) => handleFieldChange(idx, "first_name", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input 
                    className={`w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 focus:ring-0 text-sm py-1 px-1 transition-all ${!contact.last_name ? 'bg-red-50 border-red-200' : ''}`}
                    value={contact.last_name || ""} 
                    placeholder="Last Name"
                    onChange={(e) => handleFieldChange(idx, "last_name", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input 
                    className="w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 focus:ring-0 text-sm py-1 px-1 transition-all"
                    value={contact.company_name || ""} 
                    placeholder="Company Name (optional)"
                    onChange={(e) => handleFieldChange(idx, "company_name", e.target.value)}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <button 
                    onClick={() => handleRemove(idx)}
                    className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {contacts.length === 0 && (
          <div className="text-center py-12 text-slate-400 bg-white">
            <Info className="h-8 w-8 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No rows to display. Please upload a file.</p>
          </div>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-xs text-slate-400 max-w-sm">
            Rows marked with <span className="text-red-500 font-bold">Fix Me</span> must be completed before they can be imported. 
            Rows left with errors will be skipped.
        </div>
        <div className="flex gap-3">
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
            <button
              onClick={() => router.push("/contacts")}
              className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-all"
            >
              Discard
            </button>
            <button
              onClick={handleCommit}
              disabled={importing || validCount === 0}
              className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {importing ? "Importing..." : `Import ${validCount} Contacts`}
            </button>
        </div>
      </div>
    </div>
  );
}
