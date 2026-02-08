import { HttpAuthentication } from '@/shared/http/http-authentication'
import { Nullable } from '@/shared/types'
import { HttpRequest } from './http-request'

export interface IHttpClient {
  send<T>(request: HttpRequest): Promise<T>
  setAuthentication(auth: Nullable<HttpAuthentication>): void
}
