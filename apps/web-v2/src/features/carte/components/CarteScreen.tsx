/**
 * QUOI     — l'onglet Carte : le fond parchemin, les lieux en calques, le relief qui se lève
 *            quand on incline, la recherche et le filtre, le nom du territoire, la rose des vents,
 *            « Ma position » (spec Carte).
 * ATTENTION — la feuille du filtre et « Seulement mes lieux » sont un réglage de la vue, gardé
 *            ici : pas d'adresse, le retour arrière ne les rouvrirait pas avec leur valeur.
 * POURQUOI — la carte est créée une fois et vit tant que l'onglet est monté ; les lieux arrivent
 *            ensuite et se redessinent quand ils changent, ou quand l'option « Mes lieux en
 *            couleur » bascule.
 *            L'attribution OpenStreetMap est obligatoire : elle reste, repliée.
 */
import maplibregl, { type GeoJSONSource, type Map as Carte } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import filtre from '@/assets/ui/filtre.svg'
import position from '@/assets/ui/position.svg'
import roseDesVents from '@/assets/ui/rose-des-vents.svg'
import { Button } from '@/shared/ui/Button'
import { useCarteLieux } from '../hooks/useCarteLieux'
import { useLieuxEnCouleur } from '../hooks/useLieuxEnCouleur'
import { useTerritoire } from '../hooks/useTerritoire'
import { ajouterCalques, CALQUE_GROUPES, CALQUES_LIEUX, enGeoJSON, SOURCE } from '../lib/calques'
import { lireCouleurs } from '../lib/couleurs'
import { reliefVoulu } from '../lib/relief'
import { ajouterMarques } from '../lib/sceaux'
import { styleParchemin } from '../lib/style'
import styles from './CarteScreen.module.css'
import { FiltreFeuille } from './FiltreFeuille'
import { Inscription } from './Inscription'
import { Recherche } from './Recherche'

const FOND = 'https://tiles.openfreemap.org/styles/liberty'
const FRANCE = { center: [2.4, 46.6] as [number, number], zoom: 5 }
const DUREE_MESSAGE = 3000

type Vue = { lat: number; lng: number; zoom: number }

export function CarteScreen() {
  const conteneur = useRef<HTMLDivElement>(null)
  const [carte, setCarte] = useState<Carte | null>(null)
  const [couleurs] = useState(() => lireCouleurs(document.documentElement))
  const { lieux, erreur, reessayer } = useCarteLieux()
  const couleurTypes = useLieuxEnCouleur()
  const navigate = useNavigate()
  const [vue, setVue] = useState<Vue | null>(null)
  const territoire = useTerritoire(vue)
  const [sansPosition, setSansPosition] = useState(false)
  const [filtreOuvert, setFiltreOuvert] = useState(false)
  const [mesLieux, setMesLieux] = useState(false)

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

    const lireVue = () => {
      const { lat, lng } = map.getCenter()
      setVue({ lat, lng, zoom: map.getZoom() })
    }
    map.on('moveend', lireVue)

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
      lireVue()
    })
    return () => {
      map.remove()
    }
  }, [couleurs, navigate])

  useEffect(() => {
    if (!carte || !lieux) return
    const montres = mesLieux ? lieux.filter((l) => l.etat !== 'inconnu') : lieux
    void ajouterMarques(carte, montres, couleurs, couleurTypes).then(() => {
      carte.getSource<GeoJSONSource>(SOURCE)?.setData(enGeoJSON(montres, couleurTypes))
    })
  }, [carte, lieux, couleurs, couleurTypes, mesLieux])

  useEffect(() => {
    if (!sansPosition) return
    const minuteur = setTimeout(() => {
      setSansPosition(false)
    }, DUREE_MESSAGE)
    return () => {
      clearTimeout(minuteur)
    }
  }, [sansPosition])

  function allerAMaPosition() {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => carte?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 13 }),
      () => {
        setSansPosition(true)
      },
    )
  }

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
      <div className={styles.haut}>
        <Recherche
          lieux={lieux ?? []}
          onAller={({ lat, lng }) => carte?.flyTo({ center: [lng, lat], zoom: 14 })}
        />
        <button
          type="button"
          className={styles.filtre}
          aria-label="Filtre"
          onClick={() => {
            setFiltreOuvert(true)
          }}
        >
          <img src={filtre} alt="" />
        </button>
      </div>
      <div className={styles.inscription}>
        <Inscription nom={territoire} />
      </div>
      <img className={styles.rose} src={roseDesVents} alt="" />
      {sansPosition && (
        <p role="status" className={styles.message}>
          Position indisponible
        </p>
      )}
      <button
        type="button"
        className={styles.position}
        aria-label="Ma position"
        onClick={allerAMaPosition}
      >
        <img src={position} alt="" />
      </button>
      {filtreOuvert && (
        <FiltreFeuille
          mesLieux={mesLieux}
          onMesLieux={setMesLieux}
          onFermer={() => {
            setFiltreOuvert(false)
          }}
        />
      )}
    </div>
  )
}
