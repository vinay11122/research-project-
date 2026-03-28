export interface CampaignAnalyticsOverview {
  campaign_id: number
  sent: number
  opened: number
  clicked: number
  replied: number
  open_rate: number
  reply_rate: number
}

export interface CampaignStepAnalytics {
  step_number: number
  template_name: string
  sent: number
  opened: number
  clicked: number
  replied: number
}
