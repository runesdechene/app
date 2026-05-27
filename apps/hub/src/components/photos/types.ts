// Types partagés de la section Photos (modération hub).

export type PhotoStatus = 'pending' | 'approved' | 'archived'
export type SubmitterRole = 'client' | 'ambassadeur' | 'partenaire'

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v']
export const isVideoUrl = (url: string) => VIDEO_EXTENSIONS.some(ext => url.toLowerCase().endsWith(ext))

export interface SubmissionImage {
  id: string
  image_url: string
  sort_order: number
  status: 'pending' | 'approved' | 'archived'
  size: string | null            // valeur taille, 'none' = aucun produit porté, null = non renseigné
  product_worn: string | null    // produit tagué au hub, par photo
  shopify_product_id: string | null
  shopify_product_handle: string | null
  shopify_product_title: string | null
  shopify_media_id: string | null
}

export interface PhotoTag {
  id: string
  name: string
}

export interface PhotoSubmission {
  id: string
  user_id: string
  submitter_name: string
  submitter_email: string
  submitter_instagram: string | null
  submitter_role: SubmitterRole | null
  location_name: string | null
  location_zip: string | null
  message: string | null
  product_size: string | null
  model_height_cm: number | null
  model_shoulder_width_cm: number | null
  product_worn: string | null
  consent_brand_usage: boolean
  status: PhotoStatus
  created_at: string
  departement: string | null
  quest_ref: string | null
  reward_crowns: number | null
  hub_submission_images: SubmissionImage[]
  tags: PhotoTag[]
}

export const STATUS_LABELS: Record<PhotoStatus, string> = {
  pending: 'En attente',
  approved: 'Validees',
  archived: 'Archivees'
}

export const STATUS_COLORS: Record<PhotoStatus, string> = {
  pending: '#f59e0b',
  approved: '#22c55e',
  archived: '#6b7280'
}

export const ROLE_LABELS: Record<SubmitterRole, string> = {
  client: 'Client',
  ambassadeur: 'Ambassadeur',
  partenaire: 'Partenaire'
}

export const ROLE_COLORS: Record<SubmitterRole, string> = {
  client: '#6366f1',
  ambassadeur: '#f59e0b',
  partenaire: '#06b6d4'
}
