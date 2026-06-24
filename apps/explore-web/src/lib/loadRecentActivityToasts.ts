// Charge les events récents et les affiche en toasts (7 jours max).
// Extrait de usePlayer.ts dans le sprint Purification (B14, mai 2026).
//
// V071 : on appelle get_recent_activity (global) ET get_my_recent_activity
// (mes events à moi) en parallèle, puis on dédup par id. Sans ça, mes
// propres énigmes/plantages peuvent être noyés dans le flot global et
// ne plus apparaître au reload.

import { supabase } from './supabase'
import { useToastStore } from '../stores/toastStore'
import type { GameToast } from '../stores/toastStore'
import { useGloryRulesStore } from '../stores/gloryRulesStore'
import { COURT_TYPES, buildCourtToast, type CourtActivityRow } from './courtToastMessages'

export async function loadRecentActivityToasts(currentUserId: string) {
  const [globalRes, myRes] = await Promise.all([
    supabase.rpc('get_recent_activity', { p_limit: 50 }),
    supabase.rpc('get_my_recent_activity', { p_user_id: currentUserId, p_limit: 50 }),
  ])
  const globalArr = Array.isArray(globalRes.data) ? globalRes.data : []
  const myArr = Array.isArray(myRes.data) ? myRes.data : []
  const seen = new Set<number>()
  const data: typeof globalArr = []
  for (const e of [...globalArr, ...myArr]) {
    const id = (e as { id: number }).id
    if (seen.has(id)) continue
    seen.add(id)
    data.push(e)
  }
  if (data.length === 0) return

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const addToast = useToastStore.getState().addToast

  const recent = (data as Array<{
    type: string
    actor_id: string
    place_id: string | null
    faction_id: string | null
    data: {
      placeTitle?: string
      placeLatitude?: number
      placeLongitude?: number
      factionTitle?: string
      factionColor?: string
      factionPattern?: string
      actorName?: string
      previousClaimedBy?: string
      previousFactionId?: string
      previousFactionTitle?: string
      previousClaimerName?: string
      previousActorId?: string
      previousActorName?: string
      gloryGain?: number
      contributionType?: string
      points?: number
      influenceGain?: number
      eruditionGain?: number
      enigmaType?: string
      difficulty?: string
      actorAvatarUrl?: string
      fragmentId?: number
      fragmentName?: string
      fragmentIcon?: string | null
      fragmentIconUrl?: string | null
    }
    created_at: string
  }>)
    .filter(e => new Date(e.created_at).getTime() > cutoff)

  for (const e of recent) {
    // V070 — on inclut désormais les actions de SOI-MÊME au reload (avant
    // c'était skip systématique, mais Uriel veut que les toasts soient
    // persistants entre les rechargements). Seule exception : new_user
    // (c'est SA propre connexion, on ne va pas se notifier soi-même
    // d'avoir rejoint la carte).
    if (e.type === 'new_user' && e.actor_id === currentUserId) continue
    // De même, on ne se notifie pas soi-même d'avoir rejoint une faction.
    if ((e.type === 'faction_join' || e.type === 'faction_leave') && e.actor_id === currentUserId) continue
    // Ignorer le tracking interne fragment_enigma
    if (e.type === 'fragment_enigma') continue

    // V097 — types Cour : déléguer au helper centralisé pour cohérence
    // avec useCourtNotifications (live-feed Realtime).
    if (COURT_TYPES.has(e.type)) {
      const built = buildCourtToast(e as CourtActivityRow, currentUserId)
      if (built) {
        useToastStore.getState().addToast({
          type: 'court',
          message: built.message,
          highlights: built.highlights,
          // V097.1 — actorId mappé uniquement si actor en highlights[0]
          actorId: built.hasActorInHighlights ? (e.actor_id ?? undefined) : undefined,
          placeId: e.place_id ?? undefined,
          timestamp: new Date(e.created_at).getTime(),
        })
      }
      continue
    }

    const name = e.data?.actorName || 'Quelqu\'un'
    const place = e.data?.placeTitle || 'un lieu'
    const actorAvatarUrl = e.data?.actorAvatarUrl ?? undefined

    let message = ''
    let type: GameToast['type'] = 'discover'
    const highlights: string[] = []
    let color: string | undefined = e.data?.factionColor ?? undefined
    let iconUrl: string | undefined
    let contested = false

    // V0.6 — toasts d'historique (7 derniers jours) épurés.
    // Skip V0.5 figés (claim, fortify, place_influence) + harvest_crown
    // (récolte de couronne : feedback déjà donné par l'animation du coffre +
    // le compteur Couronnes dans la stats bar — le toast est redondant).
    if (e.type === 'claim' || e.type === 'fortify' || e.type === 'place_influence' || e.type === 'harvest_crown') {
      continue
    } else if (e.type === 'plant_flag') {
      message = `${name} a planté son étendard sur ${place} 🚩`
      highlights.push(name, place)
      type = 'plant_flag'
      color = e.data?.factionColor ?? undefined
      iconUrl = e.data?.factionPattern ?? undefined
    } else if (e.type === 'discover' || e.type === 'explore') {
      message = `${name} a levé le brouillard sur ${place}`
      highlights.push(name, place)
      type = 'discover'
    } else if (e.type === 'like') {
      message = `${name} a aimé ${place}`
      highlights.push(name, place)
      type = 'like'
    } else if (e.type === 'new_place') {
      message = `${name} a ajouté ${place} 🏛️`
      highlights.push(name, place)
      type = 'new_place'
    } else if (e.type === 'new_user') {
      message = `${name} a rejoint la carte`
      highlights.push(name)
      type = 'new_user'
    } else if (e.type === 'faction_join') {
      const factionTitle = e.data?.factionTitle || 'une faction'
      message = `Un renfort pour ${factionTitle} : ${name} 🛡️`
      highlights.push(name, factionTitle)
      type = 'faction_join'
      color = e.data?.factionColor ?? undefined
      iconUrl = e.data?.factionPattern ?? undefined
    } else if (e.type === 'faction_leave') {
      const factionTitle = e.data?.factionTitle || 'une Compagnie'
      message = `${name} a quitté ${factionTitle}`
      highlights.push(name, factionTitle)
      type = 'faction_leave'
      color = e.data?.factionColor ?? undefined
    } else if (e.type === 'contribute') {
      // V0.7 — wording aligné par contributionType (cf. usePlayer.ts ligne ~329)
      const ct = e.data?.contributionType ?? 'carnet'
      switch (ct) {
        case 'photo':         message = `${name} a ajouté une photo de ${place} 📷`; break
        case 'comment':       message = `${name} a commenté ${place} 💬`; break
        case 'reply':         message = `${name} a répondu à un commentaire sur ${place} 💬`; break
        case 'description':   message = `${name} a enrichi la description de ${place} 📖`; break
        case 'carnet':        message = `${name} a écrit un récit sur ${place} 📜`; break
        case 'accessibility': message = `${name} a renseigné l'accessibilité de ${place}`; break
        case 'season':        message = `${name} a renseigné la saison idéale de ${place}`; break
        case 'warning':       message = `${name} a ajouté une mise en garde sur ${place}`; break
        case 'epoch':         message = `${name} a renseigné l'époque de ${place}`; break
        default:              message = `${name} a enrichi la fiche de ${place}`
      }
      highlights.push(name, place)
      type = 'contribute'
      color = e.data?.factionColor ?? undefined
      iconUrl = e.data?.factionPattern ?? undefined
    } else if (e.type === 'revisit_gps') {
      message = `${name} est de retour sur ${place}`
      highlights.push(name, place)
      type = 'revisit'
      color = e.data?.factionColor ?? undefined
      iconUrl = e.data?.factionPattern ?? undefined
    } else if (e.type === 'enigma_success') {
      // V069/070 — affiche type (avec nom du fragment si applicable) + difficulté + gain.
      const diff = e.data?.difficulty ?? 'easy'
      const diffLabel = diff === 'very_easy' ? 'très facile'
                      : diff === 'medium'    ? 'moyenne'
                      : diff === 'hard'      ? 'difficile'
                      : 'facile'
      const kind = e.data?.enigmaType ?? 'daily'
      const fragmentName = e.data?.fragmentName ?? null
      const kindLabel = kind === 'fragment'
                          ? (fragmentName ? `du fragment ${fragmentName}` : 'de codex')
                      : kind === 'place'    ? "d'un lieu"
                      : 'du jour'
      const r = useGloryRulesStore.getState().rules
      const keyG = diff === 'very_easy' ? 'glory.enigma_very_easy'
                 : diff === 'medium'    ? 'glory.enigma_medium'
                 : diff === 'hard'      ? 'glory.enigma_hard'
                 : 'glory.enigma_easy'
      const keyC = diff === 'very_easy' ? 'coupe.enigma_very_easy'
                 : diff === 'medium'    ? 'coupe.enigma_medium'
                 : diff === 'hard'      ? 'coupe.enigma_hard'
                 : 'coupe.enigma_easy'
      const gainG = r[keyG] ?? 1
      const gainC = r[keyC] ?? 1
      const gainK = (e.data as { crownsGain?: number })?.crownsGain ?? 0
      // V0.7.6 — icônes inline par gain (aligné avec EnigmaResult / usePlayer).
      const parts: string[] = []
      if (gainG > 0) parts.push(`🎖️ +${gainG}`)
      if (gainC > 0) parts.push(`🏆 +${gainC}`)
      if (gainK > 0) parts.push(`🪙 +${gainK}`)
      message = `${name} a résolu une énigme ${kindLabel} (${diffLabel}) ${parts.join(' / ')}`
      highlights.push(name)
      if (kind === 'fragment' && fragmentName) {
        highlights.push(fragmentName)
      }
      type = 'enigma'
    } else {
      continue
    }

    const hasLocation = e.data?.placeLatitude != null && e.data?.placeLongitude != null
    addToast({
      type,
      message,
      highlights,
      color,
      iconUrl,
      contested,
      actorId: e.actor_id ?? undefined,
      actorAvatarUrl,
      previousActorId: e.data?.previousClaimedBy ?? undefined,
      placeId: e.place_id ?? undefined,
      placeLocation: hasLocation
        ? { latitude: e.data!.placeLatitude!, longitude: e.data!.placeLongitude! }
        : undefined,
      fragmentId: e.data?.fragmentId,
      fragmentName: e.data?.fragmentName,
      fragmentIcon: e.data?.fragmentIcon,
      fragmentIconUrl: e.data?.fragmentIconUrl,
      timestamp: new Date(e.created_at).getTime(),
    })
  }
}
