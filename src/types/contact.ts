export interface Contact {
  id: number
  first_name: string
  last_name: string
  full_name: string
  email: string
  company_name?: string
  title?: string
  linkedin_url?: string
  external_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
}
