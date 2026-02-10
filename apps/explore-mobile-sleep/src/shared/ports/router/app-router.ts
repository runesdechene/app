import { IRouter } from '@/shared/ports/router/router'
import { Href, router } from 'expo-router'

export class AppRouter implements IRouter<Href> {
  resetTo(href: Href) {
    router.dismissAll()
    router.replace(href)
  }

  replace(url: Href) {
    router.replace(url)
  }

  push(url: Href) {
    router.push(url)
  }

  back() {
    router.back()
  }
}
