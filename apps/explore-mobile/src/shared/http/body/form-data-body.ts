import { IHttpBody } from './http-body'

export class FormDataBody implements IHttpBody {
  constructor(private readonly body: FormData) {}

  getValue(): FormData {
    return this.body
  }

  getContentType(): string {
    return 'multipart/form-data'
  }

  getHttpBody() {
    return this.body
  }
}
