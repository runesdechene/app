// Types partagés du profil joueur — extraits de PlayerProfileModal pendant
// le sprint Purification (B15, mai 2026).
//
// Ces types décrivent la structure JSON renvoyée par get_player_profile
// (cf. mig 045 + 051 + 067) et les helpers d'affichage qui en dépendent.

export interface PlaceCard {
  id: string
  title: string
  type: string
  imageUrl: string | null
  /** URL de l'icône du tag primary du lieu (image servie sur Supabase). Null si pas de tag primary. */
  tagIcon: string | null
  /** Couleur du tag primary (fond du cercle qui entoure l'icône). Null si pas de tag primary. */
  tagColor: string | null
}

export interface AuthoredPlace extends PlaceCard {
  createdAt: string
}

export interface VisitedPlace extends PlaceCard {
  visitsCount: number
  lastVisitedAt: string
}

export interface FavoritePlace extends PlaceCard {
  totalPoints: number
  lastActionAt: string
}

export interface VeilledPlace extends PlaceCard {
  plantedAt: string
  memberCount: number
  /** V0.9.53 — false = étendard planté en GPS, true = lieu tenu à distance via La
   *  Cour (Couronnes). Le carrousel « Étendard planté » ne garde que le GPS ;
   *  le badge « lieux protégés » compte les deux (veilledPlaces.length). */
  byInfluence?: boolean
}

export type PlacesTab = 'authored' | 'discovered' | 'veilled' | 'wishlist'

export interface TitleInfo {
  id: number
  name: string
  icon: string
  icon_url?: string
}

export interface PlayerProfile {
  userId: string
  name: string
  factionId: string | null
  factionTitle: string | null
  factionColor: string | null
  factionPattern: string | null
  /** V0.9 — bannière illustrée de la faction (factions.image_url), affichée à gauche
   *  du nom. Fallback sur factionPattern si la faction n'a pas encore de bannière. */
  factionImage: string | null
  /** Compagnie ALLIÉE (2e adhésion ≠ principale) — null si aucune. Social, 0 point. */
  allyFactionId: string | null
  allyFactionTitle: string | null
  allyFactionColor: string | null
  allyFactionPattern: string | null
  profileImage: string | null
  notorietyPoints: number
  /** V0.5 fields */
  explorationPoints?: number
  eruditionPoints?: number
  influenceStock?: number
  influencePlaced?: number
  glory?: number
  /** V0.7 phase 3.5 — nouveaux compteurs (mig 030 + 031) */
  lieuxExplores?: number
  lieuxVeilles?: number
  enigmasSolved?: number
  /** V0.7 Niveaux — exposés par get_player_profile (mig 045) */
  level?: number
  xpTotal?: number
  xpToNextLevel?: number
  xpForNextLevel?: number
  /** V158 (10/05) — seuil bas du niveau courant (pour fix progress bar) */
  xpForCurrentLevel?: number
  veteranFirstEra?: boolean
  /** V0.7 — Couronnes & Coupe exposés pour tous les profils (mig 051) */
  crownsBalance?: number
  coupeScoreCurrentSeason?: number
  coupeSeasonName?: string | null
  joinedAt: string
  displayedGeneralTitles: TitleInfo[] | null
  factionTitle2: TitleInfo | null
  biography: string
  instagram: string | null
  authoredPlaces: AuthoredPlace[]
  discoveredPlaces: VisitedPlace[]
  /** V0.5 legacy — gardé pour rétrocompat mais l'onglet est remplacé par veilled */
  favoritePlaces: FavoritePlace[]
  /** V0.7 phase 3.5 — lieux actuellement veillés (mig 032) */
  veilledPlaces: VeilledPlace[]
  /** V0.9.53 — lieux « à visiter » (place_wishlist), publics (mig 245) */
  wishlistPlaces: PlaceCard[]
  unlockedGeneralTitles: Array<{ id: number; name: string; icon: string; unlocks: string[]; order: number }> | null
}
