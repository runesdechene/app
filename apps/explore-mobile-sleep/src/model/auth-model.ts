import { Nullable } from '@/shared/types'

export type Token = {
  expiresAt: Date
  value: string
}

export type AuthData = {
  user: User
  accessToken: Token
  refreshToken: Token
}

export type User = {
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
