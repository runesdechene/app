export interface IRouter<THref = string> {
  resetTo(url: THref): void
  replace(url: THref): void
  push(url: THref): void
  back(): void
}
