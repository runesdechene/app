import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useToastStore } from '../stores/toastStore'
import type { GameToast } from '../stores/toastStore'
import { useAuth } from './useAuth'
import { useMapStore } from '../stores/mapStore'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useGloryRulesStore } from '../stores/gloryRulesStore'
import { loadRecentActivityToasts } from '../lib/loadRecentActivityToasts'

/**
 * Hook d'initialisation du fog — à appeler UNE SEULE FOIS au niveau App.
 * Charge les découvertes, énergie, faction et avatar à l'authentification.
 */
export function usePlayer() {
  const { user, isAuthenticated } = useAuth()
  const activityChannelRef = useRef<RealtimeChannel | null>(null)

  const setDiscoveredIds = usePlayerStore(s => s.setDiscoveredIds)
  const setUserFactionId = usePlayerStore(s => s.setUserFactionId)
  const setUserId = usePlayerStore(s => s.setUserId)
  const setEnergy = usePlayerStore(s => s.setEnergy)
  const setNextPointIn = usePlayerStore(s => s.setNextPointIn)
  const setLoading = usePlayerStore(s => s.setLoading)
  const setUserAvatarUrl = usePlayerStore(s => s.setUserAvatarUrl)
  const setUserFactionColor = usePlayerStore(s => s.setUserFactionColor)
  const setUserFactionTitle = usePlayerStore(s => s.setUserFactionTitle)
  const setUserFactionPattern = usePlayerStore(s => s.setUserFactionPattern)
  const setUserName = usePlayerStore(s => s.setUserName)
  const setIsAdmin = usePlayerStore(s => s.setIsAdmin)

  useEffect(() => {
    if (!isAuthenticated || !user?.email) {
      setDiscoveredIds([])
      setEnergy(0)
      setUserFactionId(null)
      setUserFactionColor(null)
      setUserFactionTitle(null)
      setUserFactionPattern(null)
      setUserId(null)
      setUserName(null)
      setUserAvatarUrl(null)
      setIsAdmin(false)
      usePlayerStore.getState().setTutorialCompletedAt(null)
      setLoading(false)
      useToastStore.getState().clearAll()
      return
    }

    let cancelled = false

    async function init() {
      setLoading(true)

      const { data: userData } = await supabase
        .from('users')
        .select('id, faction_id, first_name, email_address, avatar_url, tutorial_completed_at, brouiller_pistes')
        .eq('email_address', user!.email)
        .single()

      if (cancelled || !userData) {
        setLoading(false)
        return
      }

      // Auto-migration : si l'ID en base (Firebase) ne matche pas auth.uid() (Supabase),
      // migrer l'ancien compte vers le nouvel UUID pour que la RLS fonctionne
      const authId = user!.id
      if (userData.id !== authId) {
        console.warn(`[usePlayer] ID mismatch detected: db=${userData.id}, auth=${authId}. Migrating...`)
        const { data: migResult } = await supabase.rpc('migrate_user_to_auth_id', {
          p_old_id: userData.id,
          p_new_id: authId,
        })
        if (migResult?.error) {
          console.error('[usePlayer] Migration RPC error:', migResult.error)
        } else {
          console.info('[usePlayer] Migration successful:', migResult)
        }

        // Vérifier l'état réel plutôt que le retour de la RPC : la migration a pu
        // être faite par le trigger d'auth (handle_new_user) en parallèle. On se
        // fie à la présence d'une ligne à l'auth.uid().
        const { data: migrated } = await supabase
          .from('users')
          .select('id, faction_id, first_name, email_address, avatar_url, tutorial_completed_at, brouiller_pistes')
          .eq('id', authId)
          .single()

        if (cancelled) {
          setLoading(false)
          return
        }

        if (migrated) {
          // Migration aboutie (par la RPC ou par le trigger) — basculer sur le nouvel ID.
          Object.assign(userData, migrated)
        } else {
          // Échec réel : ne pas continuer avec un id périmé, sinon la RLS
          // (auth.uid() = users.id) échouerait silencieusement pour toute la session.
          console.error('[usePlayer] Migration incomplète : aucune ligne à auth.uid()')
          useToastStore.getState().addToast({
            type: 'error',
            message: 'Un souci est survenu à la connexion. Réessaie de te reconnecter dans un instant.',
            timestamp: Date.now(),
          })
          setLoading(false)
          return
        }
      }

      setUserId(userData.id)
      usePlayerStore.getState().setTutorialCompletedAt(userData.tutorial_completed_at)
      // V0.7+ Brouillage GPS — privacy-by-default true (cohérent avec le DEFAULT SQL)
      usePlayerStore.getState().setBrouillerPistes(userData.brouiller_pistes ?? true)
      setUserFactionId(userData.faction_id)
      // Garder '' pour les nouveaux joueurs (déclenche l'onboarding)
      setUserName(userData.first_name ?? '')
      // Mettre a jour last_login_at pour le Hub (badge "Reactive") — via RPC
      // car RLS de public.users n'a pas de policy UPDATE (silent deny sinon).
      supabase.rpc('touch_last_login', { p_user_id: userData.id }).then(({ error }) => {
        if (error) console.warn('[usePlayer] touch_last_login failed', error)
      })
      // Debloquer les fragments pending (achats avant inscription)
      supabase.rpc('unlock_pending_fragments', { p_user_id: userData.id, p_email: user!.email }).then(({ error }) => {
        if (error) console.warn('[usePlayer] unlock_pending_fragments failed', error)
      })
      // Créer/lier le client Shopify (fire-and-forget, pas bloquant)
      if (user?.email) {
        fetch('https://hub.runesdechene.com/.netlify/functions/shopify-create-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            firstName: userData.first_name || null,
            factionTitle: null, // sera mis à jour au choix de faction
          }),
        })
          .then(res => { if (!res.ok) console.warn('[usePlayer] shopify-create-customer HTTP', res.status) })
          .catch(err => console.warn('[usePlayer] shopify-create-customer failed', err))
      }
      // Avatar direct si disponible
      if (userData.avatar_url) {
        setUserAvatarUrl(userData.avatar_url)
      }

      // Récupérer la couleur de la faction
      if (userData.faction_id) {
        supabase
          .from('factions')
          .select('title, color, pattern')
          .eq('id', userData.faction_id)
          .single()
          .then(({ data: factionData, error: factionErr }) => {
            if (cancelled) return
            if (factionErr) {
              console.warn('[usePlayer] load faction failed', factionErr)
              return
            }
            if (factionData) {
              if (factionData.title) setUserFactionTitle(factionData.title)
              if (factionData.color) setUserFactionColor(factionData.color)
              if (factionData.pattern) setUserFactionPattern(factionData.pattern)
            }
          })
      }

      const [discRes, energyRes, profileRes] = await Promise.all([
        supabase.rpc('get_user_discoveries', { p_user_id: userData.id }),
        supabase.rpc('get_user_energy', { p_user_id: userData.id }),
        supabase.rpc('get_my_informations', { p_user_id: userData.id }),
      ])

      if (cancelled) return

      if (discRes.data) {
        setDiscoveredIds(discRes.data as string[])
      }
      if (energyRes.data) {
        const ed = energyRes.data as {
          energy: number
          maxEnergy: number
          nextPointIn: number
          energyCycle: number
        }
        setEnergy(ed.energy)
        setNextPointIn(ed.nextPointIn ?? 0)
        usePlayerStore.setState({
          maxEnergy: ed.maxEnergy ?? 5,
          energyCycle: ed.energyCycle ?? 7200,
        })
      }
      if (profileRes.data) {
        const profile = profileRes.data as {
          role?: string
          profileImage?: { url: string } | null
        }
        setUserAvatarUrl(profile.profileImage?.url ?? null)
        setIsAdmin(profile.role === 'admin')
      }
      // displayedTitles = tous les titres affichés (max 3) formatés pour la carte
      const { data: playerProfile, error: profileErr } = await supabase.rpc('get_player_profile', { p_user_id: userData.id })
      if (profileErr) console.warn('[usePlayer] get_player_profile failed', profileErr)
      if (playerProfile) {
        const pp = playerProfile as { displayedGeneralTitles?: Array<{ icon: string; name: string; icon_url?: string | null }> }
        const titles = (pp.displayedGeneralTitles ?? []).map(t => {
          const prefix = t.icon_url ? '' : (t.icon ?? '')
          return `${prefix} ${t.name}`.trim()
        })
        usePlayerStore.setState({ displayedTitles: titles })
      }

      setLoading(false)

      // Charger l'activite recente et afficher en toasts
      loadRecentActivityToasts(userData.id)

      // Souscrire aux events temps réel (découvertes, claims, nouveaux joueurs)
      if (!cancelled) {
        subscribeToActivity(userData.id)
      }
    }

    function subscribeToActivity(currentUserId: string) {
      const addToast = useToastStore.getState().addToast
      const ch = supabase.channel('activity-realtime')

      ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          const e = payload.new as {
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
              authorName?: string
              authorId?: string
              contributionId?: number
              fragmentId?: number
              fragmentName?: string
              fragmentIcon?: string | null
              fragmentIconUrl?: string | null
            }
          }

          // Ignorer ses propres actions (sauf celles qui méritent un feedback à
          // l'auteur : likes, énigmes résolues, contributions sur fiche de lieu).
          const isSelf = e.actor_id === currentUserId
          if (isSelf && e.type !== 'like' && e.type !== 'enigma_success' && e.type !== 'contribute') return
          // Ignorer le tracking interne fragment_enigma (pas un toast)
          if (e.type === 'fragment_enigma') return

          const name = isSelf ? 'Vous' : (e.data?.actorName || 'Quelqu\'un')
          const place = e.data?.placeTitle || 'un lieu'
          const actorAvatarUrl = e.data?.actorAvatarUrl ?? undefined
          let message = ''
          let type: GameToast['type'] = 'discover'
          const highlights: string[] = [name]
          let color: string | undefined = e.data?.factionColor ?? undefined
          let iconUrl: string | undefined
          let contested = false

          // V067 — toasts tirés du barème centralisé (app_settings).
          // Helper local : formate "+G Gloire / +C Coupe" en omettant les 0.
          const r = useGloryRulesStore.getState().rules
          const fmt = (g: number, c: number) => {
            const parts: string[] = []
            if (g > 0) parts.push(`+${g} Gloire`)
            if (c > 0) parts.push(`+${c} Coupe`)
            return parts.join(' / ')
          }

          if (e.type === 'claim' || e.type === 'fortify' || e.type === 'place_influence' || e.type === 'harvest_crown') {
            // harvest_crown : feedback déjà donné par l'animation du coffre +
            // le compteur Couronnes dans la stats bar — toast redondant.
            return
          } else if (e.type === 'plant_flag') {
            message = isSelf
              ? `🏴 Tu as planté ta bannière à ${place} ${fmt(r['glory.plant_flag'], r['coupe.plant_flag'])}`
              : `${name} a planté son étendard sur ${place} 🚩`
            highlights.push(place)
            type = 'plant_flag'
            color = e.data?.factionColor ?? undefined
            iconUrl = e.data?.factionPattern ?? undefined
            if (e.place_id && e.faction_id) {
              useMapStore.getState().setPlaceOverride(e.place_id, {
                claimed: true,
                factionId: e.faction_id,
                tagColor: color,
                factionPattern: iconUrl,
              })
            }
          } else if (e.type === 'discover') {
            if (isSelf) {
              // V067 — découverte = mêmes points peu importe la méthode
              // (le bouton "Poser ma marque" sur place fait la visite GPS séparée).
              message = `Le brouillard se lève sur ${place} 🔍 ${fmt(r['glory.discover_remote'], r['coupe.discover_remote'])}`
            } else {
              message = `${name} a levé le brouillard sur ${place}`
            }
            highlights.push(place)
            type = 'discover'
          } else if (e.type === 'like') {
            message = isSelf ? `Vous avez aimé ${place}` : `${name} a aimé ${place}`
            highlights.push(place)
            type = 'like'
          } else if (e.type === 'like_carnet') {
            const author = e.data?.authorName || 'un explorateur'
            message = isSelf
              ? `Vous avez aimé le récit de ${author} sur ${place}`
              : `${name} a aimé un récit sur ${place}`
            highlights.push(name, place)
            type = 'like'
            color = e.data?.factionColor ?? undefined
            iconUrl = e.data?.factionPattern ?? undefined
          } else if (e.type === 'new_place') {
            // V067 — pour soi-même, AddPlaceFlow émet déjà un toast local
            // détaillé qui connait isGps (lieu + visite + plantage si sur
            // place). Skip ici pour éviter doublon.
            if (isSelf) return
            message = `${name} a ajouté ${place} 🏛️`
            highlights.push(name, place)
            type = 'new_place'
          } else if (e.type === 'new_user') {
            message = `${name} a rejoint la carte`
            type = 'new_user'
          } else if (e.type === 'faction_join') {
            const factionTitle = e.data?.factionTitle || 'une faction'
            message = `Un renfort pour ${factionTitle} : ${name} 🛡️`
            highlights.push(factionTitle)
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
            // V0.7 (mai 2026) : 6 types de contribution.
            // - photo / carnet : valorisés (gloire + coupe) via barème app_settings
            // - accessibility / season / warning / epoch : INFOS communautaires
            //   sans points (cf. décision Uriel 2026-05-03 dans contribute_to_place RPC)
            const ct = e.data?.contributionType ?? 'carnet'
            type = 'contribute'
            color = e.data?.factionColor ?? undefined
            iconUrl = e.data?.factionPattern ?? undefined

            if (ct === 'photo') {
              const g = r['glory.photo'], c = r['coupe.photo']
              message = isSelf
                ? `📷 Tu as ajouté une photo de ${place} ${fmt(g, c)}`
                : `${name} a ajouté une photo de ${place} 📜`
            } else if (ct === 'carnet') {
              const g = r['glory.carnet'], c = r['coupe.carnet']
              message = isSelf
                ? `✍️ Tu as écrit un récit sur ${place} ${fmt(g, c)}`
                : `${name} a écrit un récit sur ${place} 📜`
            } else if (ct === 'accessibility') {
              message = isSelf
                ? `♿ Tu as renseigné l'accessibilité de ${place}`
                : `${name} a renseigné l'accessibilité de ${place}`
            } else if (ct === 'season') {
              message = isSelf
                ? `🌿 Tu as renseigné la saison idéale de ${place}`
                : `${name} a renseigné la saison idéale de ${place}`
            } else if (ct === 'warning') {
              message = isSelf
                ? `⚠️ Tu as ajouté une mise en garde sur ${place}`
                : `${name} a ajouté une mise en garde sur ${place}`
            } else if (ct === 'epoch') {
              message = isSelf
                ? `🏛️ Tu as renseigné l'époque de ${place}`
                : `${name} a renseigné l'époque de ${place}`
            } else {
              // Type inconnu — fallback générique
              message = isSelf
                ? `📜 Tu as enrichi la fiche de ${place}`
                : `${name} a enrichi la fiche de ${place}`
            }
            highlights.push(place)
          } else if (e.type === 'revisit_gps') {
            // V0.6 — pas de gain pour la revisite (formule V0.7 = DISTINCT place_id)
            message = isSelf
              ? `De retour sur ${place}`
              : `${name} est de retour sur ${place}`
            highlights.push(place)
            type = 'revisit'
            color = e.data?.factionColor ?? undefined
            iconUrl = e.data?.factionPattern ?? undefined
          } else if (e.type === 'enigma_success') {
            // V067 — barème centralisé app_settings : Gloire pondérée
            // (1/2/3/5), Coupe fixe (+1 quelle que soit la difficulté
            // pour l'équité du classement / anti-triche).
            // V069+ — type d'énigme distingué (daily / fragment / place).
            // V070 — pour les fragments : nom du fragment dans le message,
            // cliquable (ouvre la modale FragmentEnigma via mapStore).
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
            // V0.7.6 — toast énigme avec icônes inline par gain (pas de 🦉 / 📖
            // résiduel — Uriel 7/05). Format aligné avec EnigmaResult.tsx.
            const enigmaParts: string[] = []
            if (gainG > 0) enigmaParts.push(`🎖️ +${gainG}`)
            if (gainC > 0) enigmaParts.push(`🏆 +${gainC}`)
            if (gainK > 0) enigmaParts.push(`🪙 +${gainK}`)
            const enigmaGains = enigmaParts.join(' / ')
            if (isSelf) {
              message = `Énigme ${kindLabel} résolue (${diffLabel}) ${enigmaGains}`
            } else {
              message = `${name} a résolu une énigme ${kindLabel} (${diffLabel}) ${enigmaGains}`
            }
            // V070 — push le nom du fragment en highlight pour le rendre cliquable
            if (kind === 'fragment' && fragmentName) {
              highlights.push(fragmentName)
            }
            type = 'enigma'
          } else {
            return
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
            timestamp: Date.now(),
          })
        },
      )

      ch.subscribe()
      activityChannelRef.current = ch
    }

    init()
    return () => {
      cancelled = true
      if (activityChannelRef.current) {
        supabase.removeChannel(activityChannelRef.current)
        activityChannelRef.current = null
      }
    }
  }, [isAuthenticated, user?.email])
}

