import { Nullable } from '@/shared/types'

export type ApiAuthenticatedUser = {
  user: {
    id: string
    emailAddress: string
    lastName: string
    role: 'user' | 'admin'
    rank: 'guest' | 'member'
    profileImage: Nullable<{
      id: string
      url: string
    }>
  }
  accessToken: {
    issuedAt: string
    expiresAt: string
    value: string
  }
  refreshToken: {
    issuedAt: string
    expiresAt: string
    value: string
  }
}

export type ApiMyInformations = {
  id: string
  emailAddress: string
  role: string
  rank: string
  gender: Nullable<string>
  lastName: string
  biography: string
  instagramId?: string
  websiteUrl?: string
  profileImage: Nullable<{
    id: string
    url: string
  }>
}
