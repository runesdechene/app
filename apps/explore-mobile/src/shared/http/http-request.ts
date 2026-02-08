import { IHttpBody } from './body/http-body'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

type Props = {
  method: Method
  url: string
  body?: IHttpBody
  headers?: Record<string, string>
}

export class HttpRequest {
  private readonly method: Method
  private readonly url: string
  private readonly body?: IHttpBody
  private readonly headers: Record<string, string>

  constructor(props: Props) {
    this.method = props.method
    this.url = props.url
    this.body = props.body
    this.headers = props.headers ?? {}
  }

  getMethod() {
    return this.method
  }

  getUrl() {
    return this.url
  }

  getBody() {
    return this.body
  }

  getHeaders() {
    return this.headers
  }

  setHeader(key: string, value: string) {
    this.headers[key] = value
  }
}
