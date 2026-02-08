import { Nullable } from '@/shared/types'
import { HttpRequest } from './http-request'

export class HttpAuthentication {
  constructor(private readonly accessToken: Nullable<string>) {}

  authenticate(request: HttpRequest) {
    if (this.accessToken) {
      request.setHeader('Authorization', `Bearer ${this.accessToken}`)
    }
  }
}
