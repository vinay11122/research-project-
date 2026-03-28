import { apiFetch } from './client'
import { DashboardOverview } from '@/types/dashboard'

export function fetchDashboardOverview() {
  return apiFetch<DashboardOverview>(
    '/dashboard/overview'
  )
}