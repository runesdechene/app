import { Nullable } from '@/shared/types'
import { Accessibility } from '@model'

export type CreatePlacePayload = {
  placeTypeId: string
  title: string
  text: string
  location: {
    latitude: number
    longitude: number
  }
  private: boolean
  images: Array<{
    id: string
    url: string
  }>
  accessibility?: Nullable<Accessibility>
  geocaching?: boolean
  sensible: boolean
  beginAt: Date | null
  endAt: Date | null
}

export type CreatePlaceResponse = {
  id: string
}

export type UpdatePlacePayload = CreatePlacePayload & {
  id: string
}

export interface IPlacesCommandGateway {
  createPlace(payload: CreatePlacePayload): Promise<CreatePlaceResponse>
  updatePlace(payload: UpdatePlacePayload): Promise<void>
  deletePlace(placeId: string): Promise<void>
  bookmarkPlace(placeId: string): Promise<void>
  removeBookmarkPlace(placeId: string): Promise<void>
  likePlace(placeId: string): Promise<void>
  removeLikePlace(placeId: string): Promise<void>
  explorePlace(placeId: string): Promise<void>
  removeExplorePlace(placeId: string): Promise<void>
  viewPlace(placeId: string): Promise<void>
}
