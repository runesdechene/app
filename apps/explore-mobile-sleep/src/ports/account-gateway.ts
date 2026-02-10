import { Nullable } from '@/shared/types'
import { ApiMyInformations } from '@model'

export type ActivateAccountRequestModel = {
  code: string
}

export type ChangeEmailAddressRequestModel = {
  emailAddress: string
}

export type ChangeInformationsRequestModel = {
  lastName?: string
  gender?: string
  biography?: string
  profileImageId?: Nullable<string>
  instagramId?: string
  websiteUrl?: string
}

export interface IAccountGateway {
  getMyUser(): Promise<ApiMyInformations>
  changeInformations(data: ChangeInformationsRequestModel): Promise<any>
  changeEmailAddress(data: ChangeEmailAddressRequestModel): Promise<any>
  activateAccount(data: ActivateAccountRequestModel): Promise<any>
  deleteAccount(): Promise<any>
}
