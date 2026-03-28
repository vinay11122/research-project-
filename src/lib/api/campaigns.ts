import { apiFetch } from './client'
import { Campaign } from '@/types/campaign'

export const CampaignAPI = {
  list: () => apiFetch<Campaign[]>('/campaigns/'),
  get: (id: number) => apiFetch<Campaign>(`/campaigns/${id}`),
  create: (data: Partial<Campaign>) => apiFetch<Campaign>('/campaigns/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (id: number, data: Partial<Campaign>) => apiFetch<Campaign>(`/campaigns/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  patch: (id: number, data: Partial<Campaign>) => apiFetch<Campaign>(`/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  remove: (id: number) => apiFetch(`/campaigns/${id}`, {
    method: 'DELETE',
  }),
  start: (id: number) => apiFetch(`/campaigns/${id}/start`, {
    method: 'POST',
  }),
  pause: (id: number) => apiFetch<{ new_status: string }>(`/campaigns/${id}/pause`, {
    method: 'POST',
  }),
  resume: (id: number) => apiFetch<{ new_status: string }>(`/campaigns/${id}/resume`, {
    method: 'POST',
  }),
  getEnrolledContacts: (id: number) => apiFetch<any[]>(`/campaigns/${id}/contacts`),
}

export type CampaignQueueItem = {
  id: number
  campaign_id: number
  contact_id: number
  contact_email?: string | null
  sequence_step_id: number
  step_number?: number | null
  template_id?: number | null
  status: string
  scheduled_at: string
  queued_at?: string | null
}

export function getCampaignQueue(
  campaignId: number,
  opts?: { status?: string; limit?: number }
) {
  const params = new URLSearchParams()
  if (opts?.status) params.set('status', opts.status)
  if (opts?.limit) params.set('limit', String(opts.limit))
  const qs = params.toString()
  return apiFetch<CampaignQueueItem[]>(`/campaigns/${campaignId}/queue${qs ? `?${qs}` : ''}`)
}

// Backward compatibility for existing imports
export const fetchCampaigns = CampaignAPI.list
export const fetchCampaign = CampaignAPI.get