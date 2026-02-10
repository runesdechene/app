import { ApiUserProfile } from '@model'

export interface IUsersQueryGateway {
  getUserProfile(userId: string): Promise<ApiUserProfile>
}
