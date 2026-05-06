// Types frontend du sous-système Expéditions joueur-joueur (V0.7+).
// Mapping côté UI = "Expédition", côté SQL = "voyage_*". La couche
// expeditionsApi.ts fait le mapping. Cf. docs/db/tech-debt.md D1.

export type ExpeditionStatus = 'published' | 'passed' | 'archived' | 'cancelled'
export type ExpeditionValidationMode = 'manual' | 'free'
export type ParticipantStatus = 'pending' | 'validated' | 'rejected' | 'withdrawn'
export type MediaKind = 'photo' | 'video'

export interface ExpeditionPersonSummary {
  user_id: string
  display_name: string
  avatar_url: string | null
  level?: number
  faction_id: string | null
  faction_title: string | null
  faction_color: string | null
}

export interface ExpeditionPendingParticipant extends ExpeditionPersonSummary {
  request_message: string | null
  joined_at: string
}

export interface ExpeditionValidatedParticipant extends ExpeditionPersonSummary {
  validated_at: string
}

export interface ExpeditionListItem {
  id: string
  name: string
  rdv_at: string | null  // null = "Date à définir" (les participants se mettent d'accord dans le chat)
  rdv_lat: number
  rdv_lng: number
  rdv_label: string | null
  call_text: string | null
  cover_image_url: string | null  // path Storage <voyage_id>/cover/...
  status: ExpeditionStatus
  slots_max: number | null
  slots_open: boolean
  validation_mode: ExpeditionValidationMode
  chief: ExpeditionPersonSummary
  validated_count: number
  unread_count?: number
  public_reports_count?: number
  i_am_chief?: boolean
  cancelled_at?: string | null
}

export interface ExpeditionDetail {
  id: string
  chief_user_id: string
  name: string
  description: string | null
  rdv_at: string | null  // null = "Date à définir"
  rdv_lat: number
  rdv_lng: number
  rdv_label: string | null
  call_text: string | null
  call_author_id: string | null
  call_updated_at: string | null
  cover_image_url: string | null
  slots_max: number | null
  slots_open: boolean
  validation_mode: ExpeditionValidationMode
  status: ExpeditionStatus
  created_at: string
  cancelled_at: string | null
}

export interface ExpeditionReportMedia {
  id: string
  storage_path: string
  kind: MediaKind
}

export interface ExpeditionReport {
  user_id: string
  display_name: string
  avatar_url: string | null
  faction_id: string | null
  faction_title: string | null
  faction_color: string | null
  text_content: string | null
  is_public: boolean
  cover_media_id: string | null
  created_at: string
  updated_at: string
  medias: ExpeditionReportMedia[] | null
}

export interface ExpeditionFullPayload {
  is_member: boolean
  my_status: 'chief' | ParticipantStatus | null
  expedition: ExpeditionDetail
  chief: ExpeditionPersonSummary
  validated_participants: ExpeditionValidatedParticipant[]
  pending_participants: ExpeditionPendingParticipant[]
  reports: ExpeditionReport[]
}

export interface ExpeditionMessage {
  id: number
  expedition_id: string
  user_id: string
  content: string
  created_at: string
}

export interface MyExpeditionsBuckets {
  upcoming: ExpeditionListItem[]
  past: ExpeditionListItem[]
  cancelled: ExpeditionListItem[]
}
