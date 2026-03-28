export type CampaignStatus = 'draft' | 'validated' | 'running' | 'paused' | 'completed'

export interface Campaign {
  id: number
  name: string
  description?: string
  status: CampaignStatus
  created_at: string
  updated_at: string
  start_at?: string | null
  limit_reset_at?: string | null
}
