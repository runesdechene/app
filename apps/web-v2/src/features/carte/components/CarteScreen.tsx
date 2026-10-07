/**
 * QUOI     — l'onglet Carte : le fond parchemin, les lieux en calques, le relief qui se lève
 *            quand on incline, la recherche et le filtre, le nom du territoire, la rose des vents,
 *            « Ma position » (spec Carte).
 * POURQUOI — la carte est créée une fois et vit tant que l'onglet est monté ; les lieux arrivent
 *            ensuite et se redessinent quand ils changent, ou quand l'option « Mes lieux en
 *            couleur » bascule. Rien n'attend ce qui peut venir après (Uriel, 02/10 : « la carte
 *            reste très longue à charger ») : les calques se posent dès que le style est prêt, sans
 *            attendre les tuiles du fond ; les icônes partent dès que les lieux arrivent ; le
 *            relief ne vient qu'une fois les lieux posés.
 *            `CarteVisiteur` : la même carte pour qui n'a pas de compte (la vitrine) — positions floutées,
 *            ni filtre, ni territoire, ni préférences ; toucher un lieu ouvre son aperçu, et la
 *            carte glisse jusqu'au lieu dont l'aperçu est ouvert.
 * ATTENTION — la feuille du filtre et les filtres (progression, natures, époques) sont un réglage
 *            de la vue, gardé ici : pas d'adresse, le retour arrière ne les rouvrirait pas avec
 *            leur valeur. Un filtre actif se voit sur le bouton.
 *            L'attribution OpenStreetMap est obligatoire : elle reste, repliée.
 */
import { maplibregl } from '@/shared/lib/maplibre'
import type { GeoJSONSource, Map as Carte } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useIsRestoring } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import filtre from '@/assets/ui/filtre.svg'
import plus from '@/assets/ui/plus.svg'
import position from '@/assets/ui/position.svg'
import roseDesVents from '@/assets/ui/rose-des-vents.svg'
import { useMaPosition } from '@/shared/hooks/useMaPosition'
import { Button } from '@/shared/ui/Button'
import { useActifs } from '../hooks/useActifs'
import { useActifsSurLaCarte } from '../hooks/useActifsSurLaCarte'
import type { Soi } from '../lib/marquesActifs'
import { useCarteLieux } from '../hooks/useCarteLieux'
import { useMesPinsSurLaCarte } from '../hooks/useMesPinsSurLaCarte'
import { useEnigmesSurLaCarte, type EnigmeTouchee } from '../hooks/useEnigmesSurLaCarte'
import { FeuilleEnigme } from './FeuilleEnigme'
import { useLieuxEnCouleur } from '../hooks/useLieuxEnCouleur'
import { useTerritoire } from '../hooks/useTerritoire'
import { ajouterCalques, CALQUES_LIEUX, echelleEcran, enGeoJSON, SOURCE } from '../lib/calques'
import { ajouterZones } from '../lib/actifs'
import { filtrer, FILTRES_VIDES, filtresActifs } from '../lib/filtres'
import { lireCouleurs } from '@/shared/lib/couleursCarte'
import { poserMesPins, surUnPin, type PinsDeLaCarte } from '../lib/mesPins'
import { poserEnigmes, surUneEnigme } from '../lib/enigmes'
import { lireCentre } from '../lib/centre'
import { claquerLaCire } from '../lib/cire'
import { dureeDouce } from '../lib/mouvement'
import { reliefVoulu } from '../lib/relief'
import { ajouterMarques, prechargerIcones } from '../lib/sceaux'
import { ajouterOmbrage, FOND, FRANCE, styleParchemin } from '@/shared/lib/styleCarte'
import { suivreSurvol } from '../lib/survol'
import { AttenteLieux } from './AttenteLieux'
import { CarteExplorateur } from './CarteExplorateur'
import styles from './CarteScreen.module.css'
import { CompteurActifs } from './CompteurActifs'
import { FeuilleActifs } from './FeuilleActifs'
import { FiltreFeuille } from './FiltreFeuille'
import { Inscription } from './Inscription'
import { Recherche } from './Recherche'

const DUREE_MESSAGE = 3000

type Vue = { lat: number; lng: number; zoom: number }

// `sousLaRecherche` : ce que la coquille pose sous la recherche (la jauge d'énergie) ;
// `soi` : son portrait, son nom et son titre sur la carte ; `onAjouter` : le « + » qui ouvre l'ajout.
export function CarteScreen({
  sousLaRecherche,
  soi = null,
  onAjouter,
  ...pins
}: {
  sousLaRecherche?: ReactNode
  soi?: Soi | null
  onAjouter?: () => void
} & PinsDeLaCarte) {
  return (
    <CarteVivante
      visiteur={false}
      sousLaRecherche={sousLaRecherche}
      soi={soi}
      onAjouter={onAjouter}
      {...pins}
    />
  )
}

// La carte de la vitrine, pour qui n'a pas de compte.
export function CarteVisiteur() {
  return <CarteVivante visiteur />
}

function CarteVivante({
  visiteur,
  sousLaRecherche,
  soi = null,
  onAjouter,
  ...pins
}: {
  visiteur: boolean
  sousLaRecherche?: ReactNode
  soi?: Soi | null
  onAjouter?: (() => void) | undefined
} & PinsDeLaCarte) {
  const conteneur = useRef<HTMLDivElement>(null)
  // La place que le tiroir du PC prend sur la carte : un repère invisible, large de
  // `--decalage-carte` (posée par la coquille ; 0 sur mobile ou tiroir replié).
  const placeDuTiroir = useRef<HTMLDivElement>(null)
  const [carte, setCarte] = useState<Carte | null>(null)
  // Le tiroir mesuré : un vol (?centre, l'aperçu du visiteur) l'attend, sinon le décalage du
  // tiroir, posé juste après, couperait le vol (MapLibre ne tient qu'un mouvement à la fois).
  const [tiroirMesure, setTiroirMesure] = useState(false)
  const [couleurs] = useState(() => lireCouleurs(document.documentElement))
  const { lieux, erreur, reessayer } = useCarteLieux(visiteur)
  // La toute première fois (rien de gardé sur l'appareil), la carte dit que les lieux arrivent.
  // On le sait une fois relue la copie gardée : sinon l'attente clignoterait à chaque ouverture.
  const relecture = useIsRestoring()
  const [premiereFois, setPremiereFois] = useState<boolean | null>(null)
  if (premiereFois === null && !relecture) setPremiereFois(lieux === undefined)
  const [lieuxPoses, setLieuxPoses] = useState(false)
  const couleurTypes = useLieuxEnCouleur(!visiteur)
  const navigate = useNavigate()
  // « Trouver sur la carte » (fiche d'un lieu) et « Les chercher sur la carte » (énigmes) arrivent par
  // l'adresse : /carte?centre=lat,lng[,zoom].
  const [recherche, setRecherche] = useSearchParams()
  const centre = recherche.get('centre')
  const [vue, setVue] = useState<Vue | null>(null)
  const territoire = useTerritoire(visiteur ? null : vue)
  // Visiteur : le lieu dont l'aperçu est ouvert (/bienvenue/carte/lieu/<id>).
  const { id: lieuOuvert } = useParams()
  const [sansPosition, setSansPosition] = useState(false)
  const [filtreOuvert, setFiltreOuvert] = useState(false)
  const [filtres, setFiltres] = useState(FILTRES_VIDES)
  // Un dessin des marques qui échoue (canevas absent, icône illisible) se dit comme un échec de
  // chargement ; « Réessayer » relance les deux.
  const [marquesEnPanne, setMarquesEnPanne] = useState(false)
  const [essai, setEssai] = useState(0)
  // Les Actifs (Explorateurs en ligne ou passés dans l'heure) et soi : pas pour la vitrine.
  const actifs = useActifs(!visiteur)
  const maPosition = useMaPosition()
  const [explorateurOuvert, setExplorateurOuvert] = useState<string | null>(null)
  const [listeOuverte, setListeOuverte] = useState(false)
  useActifsSurLaCarte(visiteur ? null : carte, actifs, maPosition, soi, setExplorateurOuvert)
  useMesPinsSurLaCarte(visiteur ? null : carte, pins, tiroirMesure)
  const [enigmeTouchee, setEnigmeTouchee] = useState<EnigmeTouchee | null>(null)
  useEnigmesSurLaCarte(visiteur ? null : carte, (t) => {
    claquerLaCire()
    setEnigmeTouchee(t)
  })
  const actifOuvert = actifs.find((a) => a.id === explorateurOuvert)

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
      if (typeof id === 'string' && !surUnPin(map, e.point) && !surUneEnigme(map, e.point)) {
        void navigate(visiteur ? `/bienvenue/carte/lieu/${id}` : `/carte/lieu/${id}`)
      }
    })

    map.on('style.load', () => {
      // Les repères du chargement (onglet Performance, ou performance.getEntriesByType('mark')).
      performance.mark('carte:style-pret')
      // Les marques à la mesure de l'écran (lue à l'ouverture de la carte).
      const ecran = echelleEcran(window.innerWidth, window.innerHeight)
      ajouterCalques(map, couleurs, ecran)
      if (!visiteur) ajouterZones(map, couleurs.route, 'billes')
      if (!visiteur) void poserMesPins(map, couleurs).catch(() => undefined)
      if (!visiteur) void poserEnigmes(map, couleurs, ecran).catch(() => undefined)
      suivreSurvol(map, CALQUES_LIEUX, ecran)
      setCarte(map)
      lireVue()
    })
    return () => {
      map.remove()
    }
  }, [couleurs, navigate, visiteur])

  // La carte vise le centre de sa partie visible : à l'ouverture, elle se pose d'emblée à côté
  // du tiroir ; quand il s'ouvre ou se replie, elle glisse à son rythme (MapLibre coupe
  // l'animation si l'on a réduit les animations).
  useEffect(() => {
    const repere = placeDuTiroir.current
    if (!carte || !repere) return
    let premiereMesure = true
    const observateur = new ResizeObserver(([entree]) => {
      if (!entree) return
      const padding = { left: entree.contentRect.width, top: 0, right: 0, bottom: 0 }
      if (premiereMesure) {
        premiereMesure = false
        carte.jumpTo({ padding })
        setTiroirMesure(true)
        return
      }
      carte.easeTo({ padding, duration: dureeDouce(document.documentElement) })
    })
    observateur.observe(repere)
    return () => {
      observateur.disconnect()
    }
  }, [carte])

  // La carte vole jusqu'à l'endroit demandé, puis l'adresse redevient /carte (sans historique).
  useEffect(() => {
    if (!carte || !centre || !tiroirMesure) return
    const vise = lireCentre(centre)
    if (vise) carte.flyTo({ center: [vise.lng, vise.lat], zoom: vise.zoom })
    setRecherche({}, { replace: true })
  }, [carte, centre, tiroirMesure, setRecherche])

  // Visiteur : la carte glisse jusqu'au lieu dont l'aperçu s'ouvre (sa position floutée).
  useEffect(() => {
    if (!visiteur || !carte || !tiroirMesure || !lieux || !lieuOuvert) return
    const lieu = lieux.find((l) => l.id === lieuOuvert)
    if (lieu) carte.flyTo({ center: [lieu.lng, lieu.lat], zoom: 11 })
  }, [visiteur, carte, tiroirMesure, lieux, lieuOuvert])

  useEffect(() => {
    if (!lieux) return
    performance.mark('carte:lieux-recus')
    prechargerIcones(lieux)
  }, [lieux])

  // Un dessin lancé avant le dernier changement (filtre, couleurs) ne doit jamais l'écraser :
  // `actif` passe à faux dès qu'un nouveau dessin part, ou que l'écran se ferme.
  useEffect(() => {
    if (!carte || !lieux) return
    let actif = true
    const montres = filtrer(lieux, filtres)
    ajouterMarques(carte, montres, couleurs, couleurTypes).then(
      () => {
        performance.mark('carte:marques-dessinees')
        if (!actif) return
        void carte.getSource<GeoJSONSource>(SOURCE)?.setData(enGeoJSON(montres, couleurTypes))
        ajouterOmbrage(carte, couleurs)
        setLieuxPoses(true)
        performance.mark('carte:lieux-poses')
      },
      () => {
        if (actif) setMarquesEnPanne(true)
      },
    )
    return () => {
      actif = false
    }
  }, [carte, lieux, couleurs, couleurTypes, filtres, essai])

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
    <div className={styles.ecran} data-sous-la-recherche={sousLaRecherche ? true : undefined}>
      <div ref={conteneur} className={styles.carte} data-testid="carte" />
      <div ref={placeDuTiroir} className={styles.placeDuTiroir} aria-hidden="true" />
      {premiereFois && <AttenteLieux finie={lieuxPoses || erreur || marquesEnPanne} />}
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
          membres={!visiteur}
          onAller={({ lat, lng }) => carte?.flyTo({ center: [lng, lat], zoom: 14 })}
        />
        {!visiteur && (
          <button
            type="button"
            className={styles.filtre}
            data-actif={filtresActifs(filtres) || undefined}
            aria-label={filtresActifs(filtres) ? 'Filtre (actif)' : 'Filtre'}
            onClick={() => {
              setFiltreOuvert(true)
            }}
          >
            <img src={filtre} alt="" />
          </button>
        )}
      </div>
      {!visiteur && (
        <div className={styles.sousLaRecherche}>
          {sousLaRecherche}
          <CompteurActifs
            nombre={actifs.length}
            onOuvrir={() => {
              setListeOuverte(true)
            }}
          />
        </div>
      )}
      <div className={styles.inscription}>
        <Inscription nom={territoire} />
      </div>
      <img className={styles.rose} src={roseDesVents} alt="" />
      {sansPosition && (
        <p role="status" className={styles.message}>
          Position indisponible
        </p>
      )}
      {onAjouter && (
        <button
          type="button"
          className={styles.ajouter}
          aria-label="Ajouter un lieu"
          onClick={onAjouter}
        >
          <img src={plus} alt="" />
        </button>
      )}
      <button
        type="button"
        className={styles.position}
        data-avec-ajouter={onAjouter ? true : undefined}
        aria-label="Ma position"
        onClick={allerAMaPosition}
      >
        <img src={position} alt="" />
      </button>
      {listeOuverte && (
        <FeuilleActifs
          actifs={actifs}
          moi={maPosition}
          onChoisir={(id) => {
            setListeOuverte(false)
            setExplorateurOuvert(id)
          }}
          onFermer={() => {
            setListeOuverte(false)
          }}
        />
      )}
      {enigmeTouchee && (
        <FeuilleEnigme
          key={enigmeTouchee.id}
          touchee={enigmeTouchee}
          onFermer={() => {
            setEnigmeTouchee(null)
          }}
        />
      )}
      {actifOuvert && (
        <CarteExplorateur
          actif={actifOuvert}
          moi={maPosition}
          onFermer={() => {
            setExplorateurOuvert(null)
          }}
        />
      )}
      {filtreOuvert && (
        <FiltreFeuille
          lieux={lieux ?? []}
          filtres={filtres}
          onFiltres={setFiltres}
          onFermer={() => {
            setFiltreOuvert(false)
          }}
        />
      )}
    </div>
  )
}
