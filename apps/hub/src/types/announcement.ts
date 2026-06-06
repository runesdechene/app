// Types Hub du système d'annonces multi-canal (spec 2026-06-05).

export type AnnouncementType = 'produit' | 'app' | 'marque'
export type ChannelState = 'none' | 'ready' | 'published' | 'sent'
export type Channel = 'blog' | 'app' | 'push' | 'email' | 'insta'

export interface Announcement {
  id: string
  slug: string
  type: AnnouncementType
  title: string
  cover_image: string | null
  body: string
  push_text: string | null
  insta_caption: string | null
  status: 'draft' | 'published'
  audience: string
  shopify_article_id: string | null
  channels: Record<Channel, ChannelState>
  published_at: string | null
  created_at: string
  updated_at: string
}
