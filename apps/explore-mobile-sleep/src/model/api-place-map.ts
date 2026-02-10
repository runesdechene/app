import { Nullable } from '@/shared/types'
import { ApiPlaceType } from './api-place-type'

export type ApiPlaceMap = {
  id: string
  title: string
  type: ApiPlaceType
  location: {
    latitude: number
    longitude: number
  }
  requester: Nullable<{
    viewed: boolean
  }>
  url?: string
}
