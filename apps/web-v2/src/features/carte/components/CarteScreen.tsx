/**
 * QUOI     — l'onglet Carte : le fond parchemin, les lieux en calques, le relief qui se lève
 *            quand on incline, la recherche et le filtre, le nom du territoire, la rose des vents,
 *            « Ma position » (spec Carte).
 * POURQUOI — la carte est créée une fois et vit tant que l'onglet est monté ; les lieux arrivent
 *            ensuite et se redessinent quand ils changent, ou quand l'option « Mes lieux en
 *            couleur » bascule.
 *            `CarteVisiteur` : la même carte pour qui n'a pas de compte (la vitrine) — positions floutées,
 *            ni filtre, ni territoire, ni préférences ; toucher un lieu ouvre son aperçu, et la
 *            carte glisse jusqu'au lieu dont l'aperçu est ouvert.
 * ATTENTION — la feuille du filtre et « Seulement mes lieux » sont un réglage de la vue, gardé
 *            ici : pas d'adresse, le retour arrière ne les rouvrirait pas avec leur valeur.
 *            L'attribution OpenStreetMap est obligatoire : elle reste, repliée.
 */
import maplibregl, { type GeoJSONSource, type Map as Carte } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import filtre from '@/assets/ui/filtre.svg'
import position from '@/assets/ui/position.svg'
import roseDesVents from '@/assets/ui/rose-des-vents.svg'
import { Button } from '@/shared/ui/Button'
import { useCarteLieux } from '../hooks/useCarteLieux'
import { useLieuxEnCouleur } from '../hooks/useLieuxEnCouleur'
import { useTerritoire } from '../hooks/useTerritoire'
import { ajouterCalques, CALQUES_LIEUX, enGeoJSON, SOURCE } from '../lib/calques'
import { lireCouleurs } from '@/shared/lib/couleursCarte'
import { dureeDouce } from '../lib/mouvement'
import { reliefVoulu } from '../lib/relief'
import { ajouterMarques } from '../lib/sceaux'
import { FOND, FRANCE, styleParchemin } from '@/shared/lib/styleCarte'
import { suivreSurvol } from '../lib/survol'
import styles from './CarteScreen.module.css'
import { FiltreFeuille } from './FiltreFeuille'
import { Inscription } from './Inscription'
import { Recherche } from './Recherche'

const DUREE_MESSAGE = 3000

type Vue = { lat: number; lng: number; zoom: number }

export function CarteScreen() {
  return <CarteVivante visiteur={false} />
}

// La carte de la vitrine, pour qui n'a pas de compte.
export function CarteVisiteur() {
  return <CarteVivante visiteur />
}

function CarteVivante({ visiteur }: { visiteur: boolean }) {
  const conteneur = useRef<HTMLDivElement>(null)
  // La place que le tiroir du PC prend sur la carte : un repère invisible, large de
  // `--decalage-carte` (posée par la coquille ; 0 sur mobile ou tiroir replié).
  const placeDuTiroir = useRef<HTMLDivElement>(null)
  const [carte, setCarte] = useState<Carte | null>(null)
  const [couleurs] = useState(() => lireCouleurs(document.documentElement))
  const { lieux, erreur, reessayer } = useCarteLieux(visiteur)
  const couleurTypes = useLieuxEnCouleur(!visiteur)
  const navigate = useNavigate()
  // « Trouver sur la carte » (fiche d'un lieu) arrive par l'adresse : /carte?centre=lat,lng.
  const [recherche, setRecherche] = useSearchParams()
  const centre = recherche.get('centre')
  const [vue, setVue] = useState<Vue | null>(null)
  const territoire = useTerritoire(visiteur ? null : vue)
  // Visiteur : le lieu dont l'aperçu est ouvert (/bienvenue/carte/lieu/<id>).
  const { id: lieuOuvert } = useParams()
  const [sansPosition, setSansPosition] = useState(false)
  const [filtreOuvert, setFiltreOuvert] = useState(false)
  const [mesLieux, setMesLieux] = useState(false)
  // Un dessin des marques qui échoue (canevas absent, icône illisible) se dit comme un échec de
  // chargement ; « Réessayer » relance les deux.
  const [marquesEnPanne, setMarquesEnPanne] = useState(false)
  const [essai, setEssai] = useState(0)

  useEffect(() => {
    if (!conteneur.current) return
    const map = new maplibregl.Map({
      container: conteneur.current,
      ...FRANCE,
      maxPitch: 70,
      attributionControl: { compact: true },
    })
    map.setStyle(FOND, { transformStyle: (_avant, fond) => styleParchemin(fond, couleurs) })

    // Incliné et d'assez près, les montagnes se lèvent ; sinon, rien que l'ombrage à plat. On ne
    // touche au terrain que s'il doit changer : le reposer le reconstruit, et la carte saccade.
    const relief = () => {
      const voulu = reliefVoulu(map.getPitch(), map.getZoom())
      if (voulu === (map.getTerrain() !== null)) return
      map.setTerrain(voulu ? { source: 'relief-3d', exaggeration: 1.1 } : null)
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
      if (typeof id === 'string') {
        void navigate(visiteur ? `/bienvenue/carte/lieu/${id}` : `/carte/lieu/${id}`)
      }
    })

    map.on('load', () => {
      ajouterCalques(map, couleurs)
      suivreSurvol(map, CALQUES_LIEUX)
      setCarte(map)
      lireVue()
    })
    return () => {
      map.remove()
    }
  }, [couleurs, navigate, visiteur])

  // Quand le tiroir s'ouvre ou se replie, la carte vise le centre de sa partie visible : elle
  // glisse au rythme du tiroir (MapLibre coupe l'animation si l'on a réduit les animations).
  useEffect(() => {
    const repere = placeDuTiroir.current
    if (!carte || !repere) return
    const observateur = new ResizeObserver(([entree]) => {
      if (!entree) return
      carte.easeTo({
        padding: { left: entree.contentRect.width, top: 0, right: 0, bottom: 0 },
        duration: dureeDouce(document.documentElement),
      })
    })
    observateur.observe(repere)
    return () => {
      observateur.disconnect()
    }
  }, [carte])

  // La carte vole jusqu'au lieu demandé, puis l'adresse redevient /carte (sans historique).
  useEffect(() => {
    if (!carte || !centre) return
    const [lat, lng] = centre.split(',').map(Number)
    if (lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)) {
      carte.flyTo({ center: [lng, lat], zoom: 14 })
    }
    setRecherche({}, { replace: true })
  }, [carte, centre, setRecherche])

  // Visiteur : la carte glisse jusqu'au lieu dont l'aperçu s'ouvre (sa position floutée).
  useEffect(() => {
    if (!visiteur || !carte || !lieux || !lieuOuvert) return
    const lieu = lieux.find((l) => l.id === lieuOuvert)
    if (lieu) carte.flyTo({ center: [lieu.lng, lieu.lat], zoom: 11 })
  }, [visiteur, carte, lieux, lieuOuvert])

  // Un dessin lancé avant le dernier changement (filtre, couleurs) ne doit jamais l'écraser :
  // `actif` passe à faux dès qu'un nouveau dessin part, ou que l'écran se ferme.
  useEffect(() => {
    if (!carte || !lieux) return
    let actif = true
    const montres = mesLieux ? lieux.filter((l) => l.etat !== 'inconnu') : lieux
    ajouterMarques(carte, montres, couleurs, couleurTypes).then(
      () => {
        if (actif) carte.getSource<GeoJSONSource>(SOURCE)?.setData(enGeoJSON(montres, couleurTypes))
      },
      () => {
        if (actif) setMarquesEnPanne(true)
      },
    )
    return () => {
      actif = false
    }
  }, [carte, lieux, couleurs, couleurTypes, mesLieux, essai])

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
    if (!('geolocation' in navigator)) {
      setSansPosition(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => carte?.flyTo({ center: [coords.longitude, coords.latitude], zoom: 13 }),
      () => {
        setSansPosition(true)
      },
      { timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return (
    <div className={styles.ecran}>
      <div ref={conteneur} className={styles.carte} data-testid="carte" />
      <div ref={placeDuTiroir} className={styles.placeDuTiroir} aria-hidden="true" />
      {(erreur || marquesEnPanne) && (
        <div role="alert" className={styles.bandeau}>
          <span>Les lieux n’ont pas pu être chargés</span>
          <Button
            kind="doux"
            onClick={() => {
              setMarquesEnPanne(false)
              setEssai((n) => n + 1)
              reessayer()
            }}
          >
            Réessayer
          </Button>
        </div>
      )}
      <div className={styles.haut}>
        <Recherche
          lieux={lieux ?? []}
          onAller={({ lat, lng }) => carte?.flyTo({ center: [lng, lat], zoom: 14 })}
        />
        {!visiteur && (
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
        )}
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
