export interface IAlerter {
  error(message: string): void
  info(message: string): void
  success(message: string): void
}
