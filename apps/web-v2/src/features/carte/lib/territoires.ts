/**
 * QUOI     — les territoires sur la carte (migration 569) : un liseré de carte ancienne autour des
 *            lieux d'un même revendiquant — un trait, doublé de pointillés à l'intérieur — et son nom
 *            en capitales espacées, sous lui. Le mien au vert chêne, ceux des autres à l'encre
 *            (Uriel, 01/11, Figma 873:2576).
 * POURQUOI — sous les lieux : le liseré entoure les sceaux sans jamais les couvrir. Le nom se lit de
 *            loin et s'efface au zoom 9, quand le nom de chaque lieu prend le relais (`calques.ts`).
 * ATTENTION — les textes de carte n'existent que dans les polices du fond OpenFreeMap (Noto Sans).
 */
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import type { ExpressionSpecification, Map as Carte } from 'maplibre-gl'
import type { Coordonnees, TerritoireRevendique } from '../api/lireCarte'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'

export const SOURCE_TERRITOIRES = 'territoires'
const AVANT = 'billes' // le premier calque des lieux (calques.ts)
const NOMS_JUSQU_A = 9

type Proprietes = { nom: string; moi: boolean }

// Les pointillés vont à l'intérieur, à gauche d'un anneau parcouru dans le sens trigonométrique :
// la base ne garantit pas le sens, on le remet.
export function sensTrigonometrique(anneau: Coordonnees[]): Coordonnees[] {
  let aire = 0
  anneau.forEach(([x1, y1], i) => {
    const [x2, y2] = anneau[(i + 1) % anneau.length] ?? [x1, y1]
    aire += x1 * y2 - x2 * y1
  })
  return aire < 0 ? [...anneau].reverse() : anneau
}

export function enGeoJSONTerritoires(
  territoires: TerritoireRevendique[],
): FeatureCollection<Polygon | Point, Proprietes> {
  const features = territoires.flatMap((t): Feature<Polygon | Point, Proprietes>[] => {
    const proprietes = { nom: t.nom, moi: t.moi }
    return [
      {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [sensTrigonometrique(t.contour)] },
        properties: proprietes,
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: t.etiquette },
        properties: proprietes,
      },
    ]
  })
  return { type: 'FeatureCollection', features }
}

export function poserTerritoires(map: Carte, c: CouleursCarte) {
  const couleur: ExpressionSpecification = ['case', ['get', 'moi'], c.chene, c.encre]
  const contour: ExpressionSpecification = ['==', ['geometry-type'], 'Polygon']
  map.addSource(SOURCE_TERRITOIRES, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  map.addLayer(
    {
      id: 'territoires-pointilles',
      type: 'line',
      source: SOURCE_TERRITOIRES,
      filter: contour,
      paint: {
        'line-color': couleur,
        'line-opacity': 0.45,
        'line-width': 5,
        'line-offset': -4,
        'line-dasharray': [0.3, 0.6], // en largeurs de trait : 1,5 px pleins, 3 px vides
      },
    },
    AVANT,
  )
  map.addLayer(
    {
      id: 'territoires-trait',
      type: 'line',
      source: SOURCE_TERRITOIRES,
      filter: contour,
      paint: { 'line-color': couleur, 'line-opacity': 0.75, 'line-width': 2 },
    },
    AVANT,
  )
  map.addLayer(
    {
      id: 'territoires-noms',
      type: 'symbol',
      source: SOURCE_TERRITOIRES,
      maxzoom: NOMS_JUSQU_A,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'text-field': ['upcase', ['get', 'nom']],
        'text-font': ['Noto Sans Bold'],
        'text-size': 10,
        'text-letter-spacing': 0.3,
        'text-anchor': 'top',
        'text-offset': [0, 0.4],
      },
      paint: {
        'text-color': couleur,
        'text-halo-color': c.fond,
        'text-halo-width': 1.5,
        'text-halo-blur': 1,
      },
    },
    AVANT,
  )
}
