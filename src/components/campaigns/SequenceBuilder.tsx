import { useState, useEffect } from 'react'
import SequenceStepCard from './SequenceStepCard'
import { SequenceStep } from '@/types/sequence'
import { fetchTemplates, renderTemplate } from '@/lib/api/templates'
import { fetchContacts } from '@/lib/api/contacts'
import { Template, Contact } from '@/types'
import { createSequenceStep, attachTemplateToStep, updateSequenceStep } from '@/lib/api/sequence'
import { Loading, ErrorState } from '@/components/ui/AsyncState'
import { useToast } from '@/hooks/useToast'

interface Props {
  campaignId: number
  initialSteps: SequenceStep[]
  onSave?: () => void
}

export default function SequenceBuilder({ campaignId, initialSteps, onSave }: Props) {
  const { toast } = useToast()
  const [steps, setSteps] = useState<SequenceStep[]>(initialSteps)

  // Sync internal state with prop changes (rehydration)
  useEffect(() => {
    setSteps(initialSteps.map(s => ({
      ...s,
      id: s.id || Date.now() + Math.random(),
      template_id: s.template_id ?? undefined
    })))
  }, [initialSteps])

  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [templates, setTemplates] = useState<Template[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContactId, setSelectedContactId] = useState<number | ''>('')
  
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Preview state
  const [previewStepId, setPreviewStepId] = useState<number | null>(null)
  const [previewData, setPreviewData] = useState<{ subject: string; html: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    setLoadingInitial(true)
    try {
      const [templatesData, contactsData] = await Promise.all([
        fetchTemplates(),
        fetchContacts(0, 10)
      ])
      setTemplates(templatesData)
      setContacts(contactsData)
      if (contactsData.length > 0) {
        setSelectedContactId(contactsData[0].id)
      }
    } catch (err: any) {
      setFetchError(err.message)
    } finally {
      setLoadingInitial(false)
    }
  }

  function addStep() {
    const nextNumber = steps.length + 1
    const newStep: SequenceStep = {
      // Use a temp ID that is negative or distinct to signal "new"
      id: -Date.now(),
      step_number: nextNumber,
      delay_days: 0,
    }
    setSteps([...steps, newStep])
    setError(null)
  }

  function updateDelay(id: number, delay: number) {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, delay_days: delay } : s
      )
    )
  }

  function removeStep(id: number) {
    if (steps.length === 1) {
      setError('At least one step is required.')
      return
    }
    const filtered = steps.filter((s) => s.id !== id)
    const renumbered = filtered.map((s, index) => ({
      ...s,
      step_number: index + 1,
    }))
    setSteps(renumbered)
    if (previewStepId === id) {
      setPreviewStepId(null)
      setPreviewData(null)
    }
  }

  async function attachTemplate(stepId: number, templateId: number) {
    const template = templates.find((t) => t.id === templateId)
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? {
              ...s,
              template_id: templateId,
              template_name: template?.name,
            }
          : s
      )
    )

    // Trigger preview if contact is selected
    if (templateId && selectedContactId) {
      await fetchPreview(stepId, templateId)
    } else {
      if (previewStepId === stepId) {
        setPreviewData(null)
      }
    }
  }

  async function fetchPreview(stepId: number, templateId: number) {
    if (!selectedContactId) return
    
    setPreviewStepId(stepId)
    setPreviewLoading(true)
    try {
      const res = await renderTemplate(templateId, {
        contact_id: Number(selectedContactId),
        campaign_id: campaignId,
      })
      setPreviewData(res)
    } catch (err: any) {
      console.error('Preview failed', err)
      setPreviewData(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  function validateSequence() {
    if (steps.length === 0) {
      setError('At least one step is required.')
      return false
    }
    for (const step of steps) {
      if (step.delay_days < 0) {
        setError('Delay days cannot be negative.')
        return false
      }
      if (!step.template_id) {
        setError(`Step ${step.step_number} is missing a template.`)
        return false
      }
    }
    setError(null)
    return true
  }

  async function saveSequence() {
    if (!validateSequence()) return
    setIsSaving(true)
    setError(null)
    try {
      for (const step of steps) {
        let stepId = step.id ?? -1;
        const isNew = stepId < 0; // Temp IDs are negative

        if (!isNew) {
           // ✅ Update existing step
           await updateSequenceStep(stepId, {
             step_number: step.step_number,
             delay_days: step.delay_days,
           })
        } else {
           // ✅ Create only if it doesn't exist
           const tempId = stepId
           const created = await createSequenceStep(campaignId, {
             step_number: step.step_number,
             delay_days: step.delay_days,
           })
           
           stepId = created.id

           // ✅ Persist id into state so next save becomes UPDATE
           setSteps((prev) =>
             prev.map((s) =>
               s.id === tempId ? { ...s, id: stepId } : s
             )
           )
        }

        // ✅ Attach template (only if chosen)
        if (step.template_id) {
          await attachTemplateToStep(stepId!, step.template_id)
        }
      }
      toast('Sequence saved successfully', 'success')
      if (onSave) onSave()
    } catch (err: any) {
      console.error(err)
      setError(`Failed to save sequence: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  if (loadingInitial) return <Loading />
  if (fetchError) return <ErrorState error={fetchError} />

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Configuration Header */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700 uppercase tracking-wider">Preview as:</span>
          <select 
            value={selectedContactId}
            onChange={(e) => setSelectedContactId(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
          >
            <option value="">Select contact</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
            ))}
          </select>
        </div>
        <div className="text-xs text-slate-400 italic">
          Select a contact to see live renders below
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {steps.length > 0 ? (
          steps.map((step) => {
            const selectedTemplate = templates.find(t => t.id === step.template_id)
            const hasUnsubscribe = selectedTemplate?.body_template?.includes('{{unsubscribe_url}}')

            return (
              <div key={step.id} className="relative">
                <SequenceStepCard
                  step={step}
                  onRemove={removeStep}
                />

                <div className="mt-3 ml-6 space-y-4">
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    {/* Delay editor */}
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-medium">Delay:</span>
                      <div className="flex items-center">
                        <input
                          type="number"
                          min={0}
                          value={step.delay_days}
                          onChange={(e) => updateDelay(step.id, Number(e.target.value))}
                          className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        />
                        <span className="ml-2 text-slate-400">days</span>
                      </div>
                    </div>

                    {/* Template selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-medium">Template:</span>
                      <select
                        value={step.template_id ?? ''}
                        onChange={(e) => attachTemplate(step.id, Number(e.target.value))}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-w-[200px]"
                      >
                        <option value="">Select template</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Compliance & Preview */}
                  {selectedTemplate && (
                    <div className="space-y-3">
                      {/* Compliance Check */}
                      {!hasUnsubscribe ? (
                        <div className="bg-amber-50 border border-amber-100 text-amber-700 px-3 py-2 rounded text-xs flex items-center gap-2 font-medium">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          Missing {'{{unsubscribe_url}}'} (Required for launch)
                        </div>
                      ) : (
                        <div className="bg-green-50 border border-green-100 text-green-700 px-3 py-2 rounded text-xs flex items-center gap-2 font-medium">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Compliance check passed
                        </div>
                      )}

                      {/* Preview Toggle/Button */}
                      <button 
                        onClick={() => fetchPreview(step.id, step.template_id!)}
                        className="text-xs text-indigo-600 font-medium hover:text-indigo-800 flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        {previewStepId === step.id && previewData ? 'Refresh Live Preview' : 'Show Live Preview'}
                      </button>

                      {/* Preview Content */}
                      {previewStepId === step.id && (
                        <div className="mt-2 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                          {previewLoading ? (
                            <div className="p-8 text-center text-slate-400 text-xs animate-pulse">Generating real-time render...</div>
                          ) : previewData ? (
                            <>
                              <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Rendering</span>
                                <button onClick={() => setPreviewStepId(null)} className="text-slate-400 hover:text-slate-600">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                              <div className="p-4 space-y-3">
                                <div>
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Subject</p>
                                  <p className="text-sm font-medium text-slate-900 bg-slate-50 p-2 rounded border border-slate-100">{previewData.subject}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">Body</p>
                                  <div 
                                    className="prose prose-sm max-w-none text-slate-800 bg-slate-50 rounded p-3 border border-slate-100 min-h-[100px]"
                                    dangerouslySetInnerHTML={{ __html: previewData.html }} 
                                  />
                                </div>
                              </div>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-slate-900">No steps defined</h3>
            <p className="mt-1 text-sm text-slate-500">Get started by adding your first sequence step.</p>
          </div>
        )}
      </div>

      {/* Add step */}
      <button
        onClick={addStep}
        className="mt-4 w-full rounded-md border-2 border-dashed border-slate-300 px-4 py-4 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition-all flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Add Next Sequence Step
      </button>

      <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
        <div className="text-xs text-slate-400">
          * Sequence must be saved before the campaign can be validated.
        </div>
        <button
          onClick={saveSequence}
          disabled={isSaving}
          className="rounded-md bg-indigo-600 px-8 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving Sequence...' : 'Save Sequence'}
        </button>
      </div>
    </div>
  )
}
