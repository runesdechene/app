import { IHttpBody } from './http-body'

export class JsonBody<T> implements IHttpBody {
  constructor(private readonly body: T) {}

  getValue(): T {
    return this.body
  }

  getContentType(): string {
    return 'application/json'
  }

  getHttpBody(): string {
    return JSON.stringify(this.body)
  }
}
