import { IAlerter } from '@/shared/ports/alerter/alerter'

export class ConsoleAlerter implements IAlerter {
  error(message: string): void {
    console.error(message)
  }

  info(message: string): void {
    console.info(message)
  }

  success(message: string): void {
    console.log(message)
  }
}
