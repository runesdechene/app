import { FormDataBody } from '@/shared/http/body/form-data-body'
import { IHttpClient } from '@/shared/http/http-client.interface'
import { HttpRequest } from '@/shared/http/http-request'

export class MediaUploader {
  constructor(private readonly httpClient: IHttpClient) {}

  async storeAsUrl({ uri }: { uri: string }) {
    let uriParts = uri.split('.')
    let fileType = uriParts[uriParts.length - 1]

    const formData = new FormData()
    formData.append('image', {
      uri,
      name: `photo.${fileType}`,
      type: `image/${fileType}`,
    } as any)

    return this.httpClient.send<{ url: string }>(
      new HttpRequest({
        method: 'POST',
        url: '/medias/store-as-url',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: new FormDataBody(formData),
      }),
    )
  }

  async storeAsMedia({ uri }: { uri: string }) {
    let uriParts = uri.split('.')
    let fileType = uriParts[uriParts.length - 1]

    const formData = new FormData()
    formData.append('image', {
      uri,
      name: `photo.${fileType}`,
      type: `image/${fileType}`,
    } as any)

    return this.httpClient.send<{ id: string; url: string }>(
      new HttpRequest({
        method: 'POST',
        url: '/medias/store-as-media',
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: new FormDataBody(formData),
      }),
    )
  }
}
