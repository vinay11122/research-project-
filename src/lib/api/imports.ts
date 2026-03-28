const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://54.90.187.51:8000';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export async function previewContacts(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const url = `${API_BASE_URL.replace(/\/$/, '')}/contacts/import/preview`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (!res.ok) {
    let errorData;
    try {
      errorData = await res.json();
    } catch (e) {
      errorData = { detail: await res.text() };
    }
    
    const error: any = new Error(errorData.detail || 'Upload failed');
    error.response = {
        data: errorData,
        status: res.status
    };
    throw error;
  }

  return res.json();
}

export const previewContactImport = previewContacts;

export async function commitImportJson(contacts: any[], mode: 'skip' | 'update') {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/contacts/import/commit-json`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ contacts, mode }),
  });

  if (!res.ok) {
    let errorData;
    try {
      errorData = await res.json();
    } catch (e) {
      errorData = { detail: await res.text() };
    }
    throw new Error(errorData.detail || 'Commit failed');
  }

  return res.json();
}
