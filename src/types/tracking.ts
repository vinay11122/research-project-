export interface EmailTracking {
  email_id: string
  opens: number
}

export interface ClickTracking {
  email_id: string
  link_id: string
  clicks: number
}

export interface Reply {
  email_id: string
  contact_email: string
  received_at: string
  snippet: string
}
