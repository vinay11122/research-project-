import { apiFetch } from './client'
import { Contact } from '@/types/contact'

export type CreateContactPayload = Omit<Contact, 'id' | 'created_at' | 'updated_at'>

export function fetchContacts(skip = 0, limit = 2000) {
  return apiFetch<Contact[]>(`/contacts/?skip=${skip}&limit=${limit}`)
}

export function fetchContact(id: number) {
  return apiFetch<Contact>(`/contacts/${id}`)
}

export function createContact(payload: CreateContactPayload) {
  return apiFetch<Contact>('/contacts/', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateContact(id: number, payload: Partial<CreateContactPayload>) {
  return apiFetch<Contact>(`/contacts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteContact(id: number) {
  return apiFetch(`/contacts/${id}`, {
    method: 'DELETE',
  })
}

export function deleteAllContacts() {
  return apiFetch('/contacts/all', {
    method: 'DELETE',
  })
}
