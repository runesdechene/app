import type { Announcement } from '../types/announcement'

/** Texte push par défaut : push_text custom, sinon 1re ligne non vide du corps. */
export function defaultPushText(a: Pick<Announcement, 'push_text' | 'body'>): string {
  if (a.push_text && a.push_text.trim()) return a.push_text.trim()
  const firstLine = (a.body ?? '').split('\n').find((l) => l.trim().length > 0) ?? ''
  return firstLine.replace(/[#*_`>]/g, '').trim().slice(0, 120)
}

/** Légende Insta par défaut : caption custom, sinon titre + corps tronqué + signature. */
export function defaultInstaCaption(a: Pick<Announcement, 'insta_caption' | 'title' | 'body'>): string {
  if (a.insta_caption && a.insta_caption.trim()) return a.insta_caption
  const plain = (a.body ?? '').replace(/[#*_`>\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280)
  return `${a.title}\n\n${plain}\n\n#RunesDeChene #Patrimoine #Histoire`
}

export const CHANNEL_LABELS: Record<string, string> = {
  blog: 'Blog Shopify',
  app: 'Lecteur app',
  push: 'Push',
  email: 'Email',
  insta: 'Instagram',
}
