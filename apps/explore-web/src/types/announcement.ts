// Types V1 du système d'annonces multi-canal (spec 2026-06-05).
// Source de vérité : table Supabase `announcements`.

export type AnnouncementType = 'produit' | 'app' | 'marque'

export interface AnnouncementListItem {
  id: string
  slug: string
  type: AnnouncementType
  title: string
  cover_image: string | null
  published_at: string | null
}

export interface AnnouncementDetail extends AnnouncementListItem {
  body: string            // Markdown canonique
  audience: string
}

export interface AnnouncementComment {
  id: number
  userId: string
  userName: string
  userAvatar: string | null
  content: string
  parentId: number | null
  createdAt: string
  votesUp: number
  likedByMe: boolean
}

export interface AnnouncementSocial {
  likeCount: number
  likedByMe: boolean
  comments: AnnouncementComment[]
}
