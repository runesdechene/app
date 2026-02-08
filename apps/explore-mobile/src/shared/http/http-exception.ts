export class HttpException extends Error {
  public readonly payload?: Record<string, any>
  public readonly domainCode: string
  public readonly statusCode: number

  constructor(data: {
    domainCode: string
    statusCode: number
    message: string
    payload?: Record<string, any>
  }) {
    super(data.message)
    this.name = 'HttpException'
    this.domainCode = data.domainCode
    this.statusCode = data.statusCode
    this.payload = data.payload
  }
}
