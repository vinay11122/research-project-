import { useRouter } from 'next/router'
import { useState, useEffect, useMemo, useRef } from 'react'
import PageShell from '@/components/layout/PageShell'
import CampaignTabs from '@/components/campaigns/CampaignTabs'
import { CampaignAPI } from '@/lib/api/campaigns'
import { fetchContacts } from '@/lib/api/contacts'
import { Contact } from '@/types/contact'
import { Loading, ErrorState } from '@/components/ui/AsyncState'
import { apiFetch } from '@/lib/api/client'
import { Campaign } from '@/types/campaign'
import { getSafeId } from '@/utils/route'
import { useToast } from '@/hooks/useToast'

export default function CampaignContactsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { id } = router.query
  const campaignId = getSafeId(id)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  
  // Contacts data
  const [enrolledContacts, setEnrolledContacts] = useState<any[]>([])
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  
  // UI State
  const [view, setView] = useState<'overview' | 'enroll'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Selection State (for Enrollment UI)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [lastIndex, setLastIndex] = useState<number | null>(null)
  const [isEnrolling, setIsEnrolling] = useState(false)

  // Drag State
  const dragRef = useRef<{
    active: boolean;
    startIndex: number;
    mode: "select" | "deselect";
  } | null>(null);

  // Header Checkbox Ref (for indeterminate state)
  const headerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (campaignId === null) return
    loadData(campaignId)
  }, [campaignId])

  // Drag-to-select: clean up mouseup listener
  useEffect(() => {
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  async function loadData(id: number) {
    setLoading(true)
    try {
      const [campaignData, enrolledData] = await Promise.all([
        CampaignAPI.get(id),
        CampaignAPI.getEnrolledContacts(id)
      ])
      setCampaign(campaignData)
      setEnrolledContacts(enrolledData)
      
      // If none enrolled, automatically show enrollment UI
      if (enrolledData.length === 0) {
        switchToEnroll(id)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function switchToEnroll(id: number) {
    setView('enroll')
    setLoading(true)
    try {
      const contacts = await fetchContacts()
      setAllContacts(contacts)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleEnroll() {
    if (campaignId === null || selectedIds.size === 0) return
    setIsEnrolling(true)
    try {
      await apiFetch(`/campaigns/${campaignId}/contacts`, {
        method: 'POST',
        body: JSON.stringify({ contact_ids: Array.from(selectedIds) })
      })
      toast(`Successfully enrolled ${selectedIds.size} contacts`, 'success')
      setSelectedIds(new Set())
      // Refresh overview
      const enrolled = await CampaignAPI.getEnrolledContacts(campaignId)
      setEnrolledContacts(enrolled)
      setView('overview')
    } catch (err: any) {
      toast(`Failed to enroll contacts: ${err.message}`, 'error')
    } finally {
      setIsEnrolling(false)
    }
  }

  // --- Selection Logic (for Enrollment View) ---

  const visibleIds = useMemo(
    () => allContacts.map(c => c.id),
    [allContacts]
  );

  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some(id => selectedIds.has(id));

  // Sync indeterminate state
  useEffect(() => {
    if (headerRef.current) {
      headerRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
    }
  }, [allVisibleSelected, someVisibleSelected]);

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const selectRange = (from: number, to: number, mode: "select" | "deselect") => {
    const [a, b] = from < to ? [from, to] : [to, from];
    const rangeIds = allContacts.slice(a, b + 1).map(c => c.id);

    setSelectedIds(prev => {
      const next = new Set(prev);
      rangeIds.forEach(id => {
        if (mode === "select") next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const onRowCheckboxClick = (e: React.MouseEvent, index: number, id: number) => {
    if (e.shiftKey && lastIndex !== null) {
      const alreadySelected = selectedIds.has(id);
      selectRange(lastIndex, index, alreadySelected ? "deselect" : "select");
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
    setLastIndex(index);
  };

  const startDrag = (index: number, id: number) => {
    const mode: "select" | "deselect" = selectedIds.has(id) ? "deselect" : "select";
    dragRef.current = { active: true, startIndex: index, mode };
    selectRange(index, index, mode);
  };

  const dragEnter = (index: number) => {
    const st = dragRef.current;
    if (!st?.active) return;
    selectRange(st.startIndex, index, st.mode);
  };


  if (loading && !campaign) return <PageShell><Loading /></PageShell>
  if (error) return <PageShell><ErrorState error={error} /></PageShell>
  if (!campaign) return null

  return (
    <PageShell>
      <div className="space-y-6">
        <CampaignTabs campaignId={String(campaignId)} status={campaign.status} />

        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-slate-900">
            {view === 'overview' ? 'Enrolled Contacts' : 'Enroll Contacts'}
          </h3>
          
          <div className="flex items-center gap-3">
            {view === 'overview' ? (
              <button
                onClick={() => switchToEnroll(campaignId!)}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm transition-colors"
              >
                + Find & Enroll More
              </button>
            ) : (
              <>
                <button
                  onClick={() => setView('overview')}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                {selectedIds.size > 0 && (
                  <span className="text-sm text-slate-500">
                    {selectedIds.size} selected
                  </span>
                )}
                <button
                  onClick={handleEnroll}
                  disabled={selectedIds.size === 0 || isEnrolling}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 shadow-sm transition-colors"
                >
                  {isEnrolling ? 'Enrolling...' : 'Enroll Selected'}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white border border-slate-200 shadow-sm overflow-hidden select-none">
          {view === 'overview' ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enrolledContacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.full_name}</td>
                    <td className="px-4 py-3 text-slate-700">{c.email}</td>
                    <td className="px-4 py-3 text-slate-600">{c.company_name || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        c.status === 'replied' ? 'bg-green-100 text-green-800' :
                        c.status === 'unsubscribed' ? 'bg-red-100 text-red-800' :
                        c.status === 'bounced' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-left text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="px-4 py-3 w-10">
                    <input
                      ref={headerRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allContacts.map((c, index) => {
                  const isEnrolled = enrolledContacts.some(ec => ec.id === c.id);
                  return (
                    <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${isEnrolled ? 'opacity-50 grayscale' : ''}`}>
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          disabled={isEnrolled}
                          checked={selectedIds.has(c.id)}
                          onClick={(e) => !isEnrolled && onRowCheckboxClick(e, index, c.id)}
                          onMouseDown={() => !isEnrolled && startDrag(index, c.id)}
                          onMouseEnter={() => !isEnrolled && dragEnter(index)}
                          readOnly 
                          className={`rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 ${isEnrolled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {c.full_name}
                        {isEnrolled && <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold">Enrolled</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{c.email}</td>
                      <td className="px-4 py-3 text-slate-600">{c.company_name || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          
          {((view === 'overview' && enrolledContacts.length === 0) || (view === 'enroll' && allContacts.length === 0)) && (
             <div className="p-8 text-center text-slate-500">
                No contacts found.
             </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
