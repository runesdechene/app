import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export const distanceToNow = (date: Date) => {
  return formatDistanceToNow(date, { addSuffix: false, locale: fr })
}
