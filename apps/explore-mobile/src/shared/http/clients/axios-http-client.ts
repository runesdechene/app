import { HttpException } from '@/shared/http/http-exception'
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios'
import { Platform } from 'react-native'
import { HttpAuthentication } from '../http-authentication'
import { IHttpClient } from '../http-client.interface'
import { HttpRemote } from '../http-remote'
import { HttpRequest } from '../http-request'

export class AxiosHttpClient implements IHttpClient {
  private axios: AxiosInstance

  constructor(
    private readonly remote?: HttpRemote,
    private authentication?: HttpAuthentication,
  ) {
    this.axios = axios.create({
      baseURL: remote?.toString(),
    })
  }

  async setAuthentication(auth: HttpAuthentication) {
    this.authentication = auth
  }

  async send<T>(request: HttpRequest): Promise<T> {
    if (this.authentication) {
      this.authentication.authenticate(request)
    }

    const config: AxiosRequestConfig = {
      method: request.getMethod(),
      url: request.getUrl(),
      headers: request.getHeaders(),
    }

    const body = request.getBody()
    if (body) {
      config.data = body.getValue()
      config.headers!['Content-Type'] = body.getContentType()
    }
    config.headers!['Device-OS'] = Platform.OS
    config.headers!['Device-Version'] = Platform.Version

    try {
      const result = await this.axios.request(config)
      return result.data
    } catch (e) {
      // TODO : mieux gérer les erreurs ici
      if (e instanceof AxiosError) {
        throw new HttpException({
          statusCode: e.response?.status ?? 0,
          domainCode: e.response?.data?.clientCode ?? 'UNEXPECTED_ERROR',
          message: e.response?.data?.message ?? 'Unexpected error',
          payload: e.response?.data ?? {},
        })
      } else {
        throw new HttpException({
          statusCode: 0,
          domainCode: 'UNEXPECTED_ERROR',
          message: (e as any)?.message ?? 'Unexpected error',
          payload: {},
        })
      }
    }
  }
}
