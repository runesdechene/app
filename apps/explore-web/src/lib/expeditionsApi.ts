// API wrapper du sous-système Expéditions.
// Mappe les RPCs SQL `*_voyage` vers des fonctions JS `*Expedition`.
// Le naming SQL est 'voyage_*' (cf. docs/db/tech-debt.md D1) ; côté UI
// on parle d'Expédition partout. Ce fichier fait le pont.
//
// Standalone : lit le store via getState() (pas React-aware).
// Cf. apps/explore-web/CLAUDE.md (helpers extraits sprint Purification).

import { supabase } from './supabase'
import { usePlayerStore } from '../stores/playerStore'
import type {
  ExpeditionListItem,
  ExpeditionFullPayload,
  ExpeditionValidationMode,
  MyExpeditionsBuckets,
  ExpeditionMessage,
} from '../types/expedition'

function userIdOrThrow(): string {
  const id = usePlayerStore.getState().userId
  if (!id) throw new Error('not_authenticated')
  return id
}

// ─────────── CREATE / UPDATE / CANCEL ───────────

export async function createExpedition(input: {
  name: string
  description: string | null
  rdv_at: string | null
  rdv_lat: number
  rdv_lng: number
  rdv_label: string | null
  slots_max: number | null
  slots_open: boolean
  validation_mode: ExpeditionValidationMode
}): Promise<{ success: boolean; expedition_id?: string; error?: string }> {
  const { data, error } = await supabase.rpc('create_voyage', {
    p_user_id: userIdOrThrow(),
    p_name: input.name,
    p_description: input.description,
    p_rdv_at: input.rdv_at,
    p_rdv_lat: input.rdv_lat,
    p_rdv_lng: input.rdv_lng,
    p_rdv_label: input.rdv_label,
    p_slots_max: input.slots_max,
    p_slots_open: input.slots_open,
    p_validation_mode: input.validation_mode,
  })
  if (error) return { success: false, error: error.message }
  const d = data as { success: boolean; voyage_id?: string; error?: string }
  return { success: d.success, expedition_id: d.voyage_id, error: d.error }
}

export async function updateExpedition(expeditionId: string, patches: {
  name: string
  description: string | null
  rdv_at: string | null
  rdv_lat: number
  rdv_lng: number
  rdv_label: string | null
  slots_max: number | null
  slots_open: boolean
}): Promise<{ success: boolean; changed_fields?: string[]; error?: string }> {
  const { data, error } = await supabase.rpc('update_voyage', {
    p_user_id: userIdOrThrow(),
    p_voyage_id: expeditionId,
    p_name: patches.name,
    p_description: patches.description,
    p_rdv_at: patches.rdv_at,
    p_rdv_lat: patches.rdv_lat,
    p_rdv_lng: patches.rdv_lng,
    p_rdv_label: patches.rdv_label,
    p_slots_max: patches.slots_max,
    p_slots_open: patches.slots_open,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; changed_fields?: string[]; error?: string }
}

export async function cancelExpedition(expeditionId: string) {
  const { data, error } = await supabase.rpc('cancel_voyage', {
    p_user_id: userIdOrThrow(),
    p_voyage_id: expeditionId,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; error?: string }
}

// ─────────── READ / LISTINGS ───────────

export async function getExpedition(expeditionId: string): Promise<ExpeditionFullPayload> {
  const { data, error } = await supabase.rpc('get_voyage', {
    p_user_id: userIdOrThrow(),
    p_voyage_id: expeditionId,
  })
  if (error) throw error
  const d = data as { success: boolean; error?: string } & Record<string, unknown>
  if (!d.success) throw new Error((d.error as string) || 'get_voyage_failed')
  // Le RPC retourne 'voyage' → on mappe en 'expedition' pour le typage TS exposé
  return {
    is_member: d.is_member as boolean,
    my_status: d.my_status as ExpeditionFullPayload['my_status'],
    expedition: d.voyage as ExpeditionFullPayload['expedition'],
    chief: d.chief as ExpeditionFullPayload['chief'],
    validated_participants: (d.validated_participants ?? []) as ExpeditionFullPayload['validated_participants'],
    pending_participants: (d.pending_participants ?? []) as ExpeditionFullPayload['pending_participants'],
    reports: (d.reports ?? []) as ExpeditionFullPayload['reports'],
  }
}

export async function listUpcomingExpeditions(): Promise<ExpeditionListItem[]> {
  const { data, error } = await supabase.rpc('list_voyages_upcoming')
  if (error) throw error
  return (data as ExpeditionListItem[] | null) ?? []
}

export async function listArchivedExpeditions(limit = 50, offset = 0): Promise<ExpeditionListItem[]> {
  const { data, error } = await supabase.rpc('list_voyages_archives', {
    p_limit: limit, p_offset: offset,
  })
  if (error) throw error
  return (data as ExpeditionListItem[] | null) ?? []
}

export async function listMyExpeditions(): Promise<MyExpeditionsBuckets> {
  const { data, error } = await supabase.rpc('list_my_voyages', { p_user_id: userIdOrThrow() })
  if (error) throw error
  return data as MyExpeditionsBuckets
}

// ─────────── PARTICIPATION ───────────

export async function requestJoinExpedition(expeditionId: string, message: string | null) {
  const { data, error } = await supabase.rpc('request_join_voyage', {
    p_user_id: userIdOrThrow(),
    p_voyage_id: expeditionId,
    p_message: message,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; status?: string; error?: string }
}

export async function respondJoinRequest(
  expeditionId: string,
  targetUserId: string,
  decision: 'accept' | 'reject',
) {
  const { data, error } = await supabase.rpc('respond_voyage_join_request', {
    p_chief_user_id: userIdOrThrow(),
    p_voyage_id: expeditionId,
    p_target_user_id: targetUserId,
    p_decision: decision,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; error?: string }
}

export async function withdrawFromExpedition(expeditionId: string) {
  const { data, error } = await supabase.rpc('withdraw_from_voyage', {
    p_user_id: userIdOrThrow(),
    p_voyage_id: expeditionId,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; error?: string }
}

export async function ejectExpeditionParticipant(expeditionId: string, targetUserId: string) {
  const { data, error } = await supabase.rpc('eject_voyage_participant', {
    p_chief_user_id: userIdOrThrow(),
    p_voyage_id: expeditionId,
    p_target_user_id: targetUserId,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; error?: string }
}

export async function updateExpeditionCall(expeditionId: string, callText: string | null) {
  const { data, error } = await supabase.rpc('update_voyage_call', {
    p_user_id: userIdOrThrow(),
    p_voyage_id: expeditionId,
    p_call_text: callText,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; error?: string }
}

// ─────────── CHAT ───────────

export async function sendExpeditionMessage(expeditionId: string, content: string) {
  const { data, error } = await supabase.rpc('send_voyage_message', {
    p_user_id: userIdOrThrow(),
    p_voyage_id: expeditionId,
    p_content: content,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; error?: string }
}

export async function markExpeditionMessagesRead(expeditionId: string) {
  await supabase.rpc('mark_voyage_messages_read', {
    p_user_id: userIdOrThrow(),
    p_voyage_id: expeditionId,
  })
}

// ─────────── REPORTS / MEDIAS ───────────

export async function upsertExpeditionReport(input: {
  expedition_id: string
  text_content: string | null
  is_public: boolean
  cover_media_id: string | null
}) {
  const { data, error } = await supabase.rpc('upsert_voyage_report', {
    p_user_id: userIdOrThrow(),
    p_voyage_id: input.expedition_id,
    p_text_content: input.text_content,
    p_is_public: input.is_public,
    p_cover_media_id: input.cover_media_id,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; first_post?: boolean; error?: string }
}

export async function uploadExpeditionMedia(
  expeditionId: string,
  file: File,
  kind: 'photo' | 'video',
  durationSeconds: number | null,
): Promise<{ success: boolean; media_id?: string; storage_path?: string; error?: string }> {
  const userId = usePlayerStore.getState().userId
  if (!userId) return { success: false, error: 'not_authenticated' }

  // Validation client-side
  if (kind === 'photo' && file.size > 10 * 1024 * 1024) return { success: false, error: 'photo_too_large' }
  if (kind === 'video' && file.size > 50 * 1024 * 1024) return { success: false, error: 'video_too_large' }
  if (kind === 'video' && (durationSeconds ?? 0) > 30) return { success: false, error: 'video_too_long' }

  const ext = file.name.split('.').pop() ?? (kind === 'photo' ? 'jpg' : 'mp4')
  const path = `${expeditionId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('voyage-medias')
    .upload(path, file, { contentType: file.type })
  if (uploadError) return { success: false, error: uploadError.message }

  const { data, error: rpcError } = await supabase.rpc('register_voyage_media', {
    p_user_id: userId,
    p_voyage_id: expeditionId,
    p_storage_path: path,
    p_kind: kind,
    p_size_bytes: file.size,
    p_duration_seconds: durationSeconds,
  })
  if (rpcError) {
    // Cleanup blob orphelin si l'enregistrement échoue
    await supabase.storage.from('voyage-medias').remove([path])
    return { success: false, error: rpcError.message }
  }
  const d = data as { success: boolean; media_id?: string; error?: string }
  return { success: d.success, media_id: d.media_id, storage_path: path, error: d.error }
}

export async function deleteExpeditionMedia(mediaId: string) {
  const { data, error } = await supabase.rpc('delete_voyage_media', {
    p_user_id: userIdOrThrow(),
    p_media_id: mediaId,
  })
  if (error) return { success: false, error: error.message }
  const d = data as { success: boolean; storage_path?: string; error?: string }
  // Si OK, purger le blob côté Storage aussi
  if (d.success && d.storage_path) {
    await supabase.storage.from('voyage-medias').remove([d.storage_path])
  }
  return d
}

// ─────────── MODÉRATION ───────────

export async function flagExpedition(
  expeditionId: string,
  reason: 'spam' | 'inappropriate' | 'other',
  comment: string | null,
) {
  const { data, error } = await supabase.rpc('flag_voyage', {
    p_user_id: userIdOrThrow(),
    p_voyage_id: expeditionId,
    p_reason: reason,
    p_comment: comment,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; error?: string }
}

// ─────────── HELPERS ───────────

/**
 * Renvoie l'URL publique signée d'un média.
 * Utilisée pour afficher les photos/vidéos dans la galerie.
 * Pour les médias privés, requiert que le user soit membre validé du voyage.
 */
export function getExpeditionMediaUrl(storagePath: string): string {
  const { data } = supabase.storage.from('voyage-medias').getPublicUrl(storagePath)
  return data.publicUrl
}

/**
 * Upload une image de couverture pour un voyage.
 * Path convention : `<voyage_id>/cover/<timestamp>.<ext>`
 * Lisible par tout le monde grâce à la policy SELECT publique.
 */
export async function uploadExpeditionCover(
  expeditionId: string,
  file: File,
): Promise<{ success: boolean; storage_path?: string; error?: string }> {
  const userId = usePlayerStore.getState().userId
  if (!userId) return { success: false, error: 'not_authenticated' }
  if (file.size > 10 * 1024 * 1024) return { success: false, error: 'image_too_large' }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${expeditionId}/cover/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('voyage-medias')
    .upload(path, file, { contentType: file.type, upsert: true })
  if (uploadError) return { success: false, error: uploadError.message }

  const { data, error: rpcError } = await supabase.rpc('set_voyage_cover_image', {
    p_user_id: userId,
    p_voyage_id: expeditionId,
    p_storage_path: path,
  })
  if (rpcError) {
    await supabase.storage.from('voyage-medias').remove([path])
    return { success: false, error: rpcError.message }
  }
  const d = data as { success: boolean; error?: string }
  if (!d.success) return { success: false, error: d.error }
  return { success: true, storage_path: path }
}

export type { ExpeditionMessage } // re-export pour ergonomie
