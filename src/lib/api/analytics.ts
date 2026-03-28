import { apiFetch } from './client'
import type {
  CampaignAnalyticsOverview,
  CampaignStepAnalytics,
} from '@/types'

export function fetchCampaignOverview(
  campaignId: number
) {
  return apiFetch<CampaignAnalyticsOverview>(
    `/analytics/campaigns/${campaignId}/overview`
  )
}

export function fetchCampaignSteps(
  campaignId: number
) {
  return apiFetch<CampaignStepAnalytics[]>(
    `/analytics/campaigns/${campaignId}/steps`
  )
}

export function fetchCampaignTrend(

  campaignId: number

) {

  return apiFetch<{ date: string; replies: number }[]>(

    `/analytics/campaigns/${campaignId}/trend`

  )

}



export function fetchCampaignReplies(
  campaignId: number
) {
  return apiFetch<any[]>(
    `/analytics/campaigns/${campaignId}/replies`
  )
}

export function fetchCampaignAnalytics() {
  return apiFetch<CampaignStepAnalytics[]>('/analytics/campaigns')
}

export function fetchGlobalAnalytics() {
  return apiFetch<{
    total_campaigns: number
    running_campaigns: number
    paused_campaigns: number
    total_contacts: number
    pending_queue: number
  }>('/analytics/global')
}



