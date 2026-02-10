import { Nullable } from '@/shared/types'

export type ApiUserProfile = {
  id: string
  lastName: string
  biography: string
  profileImageUrl: Nullable<string>
  instagramId: Nullable<string>
  websiteUrl: Nullable<string>
  metrics: {
    placesAdded: number
    placesExplored: number
  }
}
