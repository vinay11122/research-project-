import { apiFetch } from './client'
import { Template } from '@/types/template'

export function fetchTemplates() {
  return apiFetch<Template[]>('/templates')
}

export function fetchTemplate(id: number) {
  return apiFetch<Template>(`/templates/${id}`)
}

export function createTemplate(data: Partial<Template>) {
  return apiFetch<Template>('/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateTemplate(id: number, data: Partial<Template>) {
  return apiFetch<Template>(`/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function renderTemplate(
  templateId: number,
  payload: {
    contact_id: number
    campaign_id: number
  }
) {
  return apiFetch<{
    subject: string
    html: string
    text: string
  }>(`/templates/${templateId}/render`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}