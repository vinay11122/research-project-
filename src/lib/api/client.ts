const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL

if (!API_BASE_URL) {
  // Only throw error on client-side or during execution if needed. 
  // Next.js might evaluate this during build.
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T | null> {
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://54.90.187.51:8000').replace(/\/$/, '')
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const url = `${baseUrl}${cleanEndpoint}`
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  
  const res = await fetch(
    url,
    {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
    }
  )

  if (!res.ok) {
    const errorText = await res.text()
    let errorData
    try {
      errorData = JSON.parse(errorText)
    } catch (e) {
      errorData = { detail: errorText }
    }
    
    const error: any = new Error(errorData.detail || `API error ${res.status}`)
    error.status = res.status
    error.response = { data: errorData }
    throw error
  }

  const text = await res.text()
  return text ? (JSON.parse(text) as T) : null
}
