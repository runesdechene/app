import { Nullable } from '@/shared/types'
import { Accessibility, ApiPlaceType } from '@model'

export type ApiPlaceDetail = {
  id: string
  title: string
  text: string
  address: string
  accessibility: Nullable<Accessibility>
  sensible: boolean
  geocaching: boolean
  author: {
    id: string
    lastName: string
    profileImageUrl: Nullable<string>
  }
  images: Array<{
    id: string
    url: string
  }>
  type: ApiPlaceType
  location: {
    latitude: number
    longitude: number
  }
  metrics: {
    views: number
    likes: number
    explored: number
    note?: number
  }
  requester: Nullable<{
    bookmarked: boolean
    liked: boolean
    explored: boolean
  }>
  lastExplorers: {
    id: string
    lastName: string
    profileImageUrl: Nullable<string>
  }[]
  beginAt?: string | null
  endAt?: string | null
}

export type ApiPlaceDetailImage = ApiPlaceDetail['images'][number]
