import { ApiTotalPlaces } from '@/model/api-total-places'
import { ApiPlaceDetail, ApiPlaceType } from '@model'

export type ChildPlaceTypesQuery = {
  parentId: string
}

export interface IPlacesQueryGateway {
  getRootPlaceTypes(): Promise<ApiPlaceType[]>
  getChildPlaceTypes(query: ChildPlaceTypesQuery): Promise<ApiPlaceType[]>
  getPlaceById(placeId: string): Promise<ApiPlaceDetail>
  getTotalPlaces(): Promise<ApiTotalPlaces>
}
