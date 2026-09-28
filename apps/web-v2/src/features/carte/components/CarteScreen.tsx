/**
 * QUOI     — l'onglet Carte : le fond parchemin, les lieux en calques, le relief qui se lève
 *            quand on incline (spec Carte).
 * POURQUOI — la carte est créée une fois et vit tant que l'onglet est monté ; les lieux arrivent
 *            ensuite et se redessinent quand ils changent, ou quand l'option « Mes lieux en
 *            couleur » bascule.
 * ATTENTION — l'attribution OpenStreetMap est obligatoire : elle reste, repliée.
 */
import maplibregl, { type GeoJSONSource, type Map as Carte } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/shared/ui/Button'
import { useCarteLieux } from '../hooks/useCarteLieux'
import { useLieuxEnCouleur } from '../hooks/useLieuxEnCouleur'
import { ajouterCalques, CALQUE_GROUPES, CALQUES_LIEUX, enGeoJSON, SOURCE } from '../lib/calques'
import { lireCouleurs } from '../lib/couleurs'
import { reliefVoulu } from '../lib/relief'
import { ajouterMarques } from '../lib/sceaux'
import { styleParchemin } from '../lib/style'
import styles from './CarteScreen.module.css'

const FOND = 'https://tiles.openfreemap.org/styles/liberty'
const FRANCE = { center: [2.4, 46.6] as [number, number], zoom: 5 }

export function CarteScreen() {
  const conteneur = useRef<HTMLDivElement>(null)
  const [carte, setCarte] = useState<Carte | null>(null)
  const [couleurs] = useState(() => lireCouleurs(document.documentElement))
  const { lieux, erreur, reessayer } = useCarteLieux()
  const couleurTypes = useLieuxEnCouleur()
  const navigate = useNavigate()

  useEffect(() => {
    if (!conteneur.current) return
    const map = new maplibregl.Map({
      container: conteneur.current,
      ...FRANCE,
      maxPitch: 70,
      attributionControl: { compact: true },
    })
    map.setStyle(FOND, { transformStyle: (_avant, fond) => styleParchemin(fond, couleurs) })

    // Incliné et d'assez près, les montagnes se lèvent ; sinon, rien que l'ombrage à plat.
    const relief = () => {
      map.setTerrain(
        reliefVoulu(map.getPitch(), map.getZoom()) ? { source: 'relief', exaggeration: 1.1 } : null,
      )
    }
    map.on('pitchend', relief)
    map.on('zoomend', relief)

    map.on('click', CALQUES_LIEUX, (e) => {
      const id: unknown = e.features?.[0]?.properties.id
      if (typeof id === 'string') void navigate(`/carte/lieu/${id}`)
    })
    map.on('click', CALQUE_GROUPES, (e) => {
      const groupe = e.features?.[0]
      const id: unknown = groupe?.properties.cluster_id
      if (!groupe || groupe.geometry.type !== 'Point' || typeof id !== 'number') return
      const [lng = 0, lat = 0] = groupe.geometry.coordinates
      const source = map.getSource<GeoJSONSource>(SOURCE)
      void source?.getClusterExpansionZoom(id).then((zoom) => {
        map.easeTo({ center: [lng, lat], zoom })
      })
    })

    map.on('load', () => {
      ajouterCalques(map, couleurs)
      setCarte(map)
    })
    return () => {
      map.remove()
    }
  }, [couleurs, navigate])

  useEffect(() => {
    if (!carte || !lieux) return
    void ajouterMarques(carte, lieux, couleurs, couleurTypes).then(() => {
      carte.getSource<GeoJSONSource>(SOURCE)?.setData(enGeoJSON(lieux, couleurTypes))
    })
  }, [carte, lieux, couleurs, couleurTypes])

  return (
    <div className={styles.ecran}>
      <div ref={conteneur} className={styles.carte} data-testid="carte" />
      {erreur && (
        <div role="alert" className={styles.bandeau}>
          <span>Les lieux n’ont pas pu être chargés</span>
          <Button kind="doux" onClick={reessayer}>
            Réessayer
          </Button>
        </div>
      )}
    </div>
  )
}
