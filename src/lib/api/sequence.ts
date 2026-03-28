import { apiFetch } from './client'

export type CreateSequenceStepPayload = {
  step_number: number
  delay_days: number
}

export type UpdateSequenceStepPayload = {
  step_number?: number
  delay_days?: number
}

export function createSequenceStep(
  campaignId: number,
  payload: CreateSequenceStepPayload
) {
  return apiFetch<{ id: number }>(`/campaigns/${campaignId}/steps`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateSequenceStep(stepId: number, payload: UpdateSequenceStepPayload) {
  return apiFetch(`/sequence-steps/${stepId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function fetchCampaignSequence(campaignId: number) {
  return apiFetch<{ id: number; name: string; steps: any[] }>(
    `/campaigns/${campaignId}/sequence`
  )
}

export function attachTemplateToStep(
  stepId: number,
  templateId: number
) {
  return apiFetch(
    `/sequence-steps/${stepId}/attach-template/${templateId}`,
    { method: 'POST' }
  )
}
