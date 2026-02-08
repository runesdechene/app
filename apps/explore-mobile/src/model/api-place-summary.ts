import { Nullable } from '@/shared/types'
import { ApiPlaceType } from './api-place-type'

export type ApiPlaceSummary = {
  id: string
  title: string
  imageUrl: Nullable<string>
  type: ApiPlaceType
  location: {
    latitude: number
    longitude: number
  }
  requester: Nullable<{
    bookmarked: boolean
    liked: boolean
    explored: boolean
  }>
  url?: string
  avg_score?: number
}
