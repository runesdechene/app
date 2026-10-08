/**
 * QUOI     — les lieux sur la carte : la source et ses calques, du dessous au dessus — billes,
 *            sceaux, points d'intérêt, lieux neufs, survol, pilules (spec Carte §3 ; les lieux neufs
 *            passent au-dessus des autres, Uriel 08/10).
 * POURQUOI — des calques MapLibre, dessinés par la carte graphique : des milliers de lieux sans
 *            ralentir. Aucun regroupement (Uriel, 28/09, comme la V1) : dézoomée, la carte montre
 *            tous les lieux, en plus petit — l'effet de constellation.
 * ATTENTION — les textes de carte n'existent que dans les polices du fond OpenFreeMap (Noto Sans).
 */
import type { FeatureCollection, Point } from 'geojson'
import type {
  AddLayerObject,
  ExpressionSpecification,
  SourceSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl'
import type { LieuCarte } from '../api/lireCarte'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'
import { nomImage } from './sceaux'

export const SOURCE = 'lieux'
export const CALQUES_LIEUX = ['billes', 'sceaux', 'curiosites', 'nouveaux']
export const CALQUE_SURVOL = 'survol'

// De près seulement : les pilules et les points d'intérêt ne chargent pas la vue d'ensemble.
const DE_PRES = 12

type Proprietes = {
  id: string
  etat: LieuCarte['etat']
  nature: LieuCarte['nature']
  image: string
  pilule?: string
  moi?: boolean
  nouveau: boolean // l'onde et la gélule « NOUVEAU » (nouveaux.ts)
  couleur: string | null // la couleur de sa nature : celle de son onde
}

export function enGeoJSON(
  lieux: LieuCarte[],
  couleurTypes: boolean,
): FeatureCollection<Point, Proprietes> {
  return {
    type: 'FeatureCollection',
    features: lieux.map((l) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
      properties: {
        id: l.id,
        etat: l.etat,
        nature: l.nature,
        image: nomImage(l, couleurTypes),
        nouveau: l.nouveau,
        couleur: l.couleur,
        ...(l.revendication && { pilule: l.revendication.nom, moi: l.revendication.moi }),
      },
    })),
  }
}

const estLieu: ExpressionSpecification = ['==', ['get', 'nature'], 'lieu']
// Un lieu neuf a son propre calque, au-dessus des autres (Uriel, 08/10 : « pour mieux se voir »).
const estNouveau: ExpressionSpecification = ['==', ['get', 'nouveau'], true]
const pasNouveau: ExpressionSpecification = ['!=', ['get', 'nouveau'], true]

// La marque grandit avec le zoom : un point de loin, le sceau entier de près.
const PALIERS: [zoom: number, taille: number][] = [
  [4, 0.5],
  [8, 0.8],
  [12, 1.15],
]

// Sur un grand écran, les marques grandissent avec lui (Uriel, 30/09 : sur un écran 2K ou 4K,
// les lieux étaient bien trop petits). Selon le plus petit côté de la fenêtre : 1 jusqu'à un
// écran 1080p, 1,4 pour un 2K, 1,8 pour un 4K et au-delà ; entre deux, on glisse de l'un à l'autre.
const ECRANS: [cote: number, echelle: number][] = [
  [1080, 1],
  [1440, 1.4],
  [2160, 1.8],
]

export function echelleEcran(largeur: number, hauteur: number): number {
  const cote = Math.min(largeur, hauteur)
  const [premier] = ECRANS
  const dernier = ECRANS[ECRANS.length - 1]
  if (!premier || !dernier || cote <= premier[0]) return 1
  if (cote >= dernier[0]) return dernier[1]
  const i = ECRANS.findIndex(([c]) => c > cote)
  const [c0, e0] = ECRANS[i - 1] ?? premier
  const [c1, e1] = ECRANS[i] ?? dernier
  return Math.round((e0 + ((cote - c0) / (c1 - c0)) * (e1 - e0)) * 20) / 20
}

// Une taille agrandie (le survol, l'écran) multiplie chaque palier : MapLibre veut la courbe de
// zoom au premier niveau, jamais enveloppée dans un calcul.
export function taille(facteur = 1): ExpressionSpecification {
  const paliers = PALIERS.flatMap(([zoom, t]) => [zoom, Math.round(t * facteur * 1000) / 1000])
  return ['interpolate', ['linear'], ['zoom'], ...paliers]
}

function marque(ecran: number): NonNullable<SymbolLayerSpecification['layout']> {
  return {
    'icon-image': ['get', 'image'],
    'icon-size': taille(ecran),
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  }
}

// Ce que ce fichier demande à la carte, et rien de plus.
type SupportDeCalques = {
  addSource: (id: string, source: SourceSpecification) => void
  addLayer: (calque: AddLayerObject) => void
}

export function ajouterCalques(map: SupportDeCalques, c: CouleursCarte, ecran = 1) {
  map.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'billes',
    type: 'symbol',
    source: SOURCE,
    filter: ['all', estLieu, pasNouveau, ['==', ['get', 'etat'], 'inconnu']],
    layout: marque(ecran),
  })
  map.addLayer({
    id: 'sceaux',
    type: 'symbol',
    source: SOURCE,
    filter: ['all', estLieu, pasNouveau, ['!=', ['get', 'etat'], 'inconnu']],
    // Un lieu visité passe au-dessus d'un lieu seulement connu.
    layout: {
      ...marque(ecran),
      'symbol-sort-key': ['case', ['==', ['get', 'etat'], 'visite'], 2, 1],
    },
  })
  map.addLayer({
    id: 'curiosites',
    type: 'symbol',
    source: SOURCE,
    minzoom: DE_PRES,
    filter: ['==', ['get', 'nature'], 'curiosite'],
    layout: marque(ecran),
  })
  // Les lieux neufs, par-dessus tous les autres ; leur onde et leur gélule : nouveaux.ts.
  map.addLayer({
    id: 'nouveaux',
    type: 'symbol',
    source: SOURCE,
    filter: ['all', estLieu, estNouveau],
    layout: marque(ecran),
  })
  // Le lieu survolé, redessiné par-dessus : c'est lui qui grossit et « pulse » au clic (survol.ts).
  map.addLayer({
    id: CALQUE_SURVOL,
    type: 'symbol',
    source: SOURCE,
    filter: ['==', ['get', 'id'], ''],
    layout: marque(ecran),
  })
  map.addLayer({
    id: 'pilules',
    type: 'symbol',
    source: SOURCE,
    minzoom: DE_PRES,
    filter: ['has', 'pilule'],
    layout: {
      'text-field': ['upcase', ['get', 'pilule']],
      'text-font': ['Noto Sans Bold'],
      'text-size': 8,
      'text-letter-spacing': 0.08,
      'text-anchor': 'top',
      'text-offset': [0, 2.1], // sous le sceau (26 px × 1,15 de près)
      'icon-image': ['case', ['get', 'moi'], 'pilule-moi', 'pilule'],
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [2, 5, 2, 5],
    },
    paint: { 'text-color': ['case', ['get', 'moi'], c.halo, c.encre] },
  })
}
