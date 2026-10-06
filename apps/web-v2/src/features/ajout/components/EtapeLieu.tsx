/**
 * QUOI     — l'étape « Où est-ce ? » (maquette 288:178) : la carte parchemin, la photo en épingle
 *            fixe au centre ; on déplace la carte sous elle. En haut, chercher un endroit ; en bas,
 *            l'endroit en mots (« Près de Colomars »), un lieu voisin s'il y en a un, « Je suis
 *            ici » et « C'est ici ».
 * POURQUOI — la carte part de la position de la photo (si l'appareil l'a notée), sinon de la
 *            mienne (si elle est déjà accordée), sinon de la France. Jamais de coordonnées à lire :
 *            des mots. Un lieu à moins de 50 m se signale ici, pas à la fin (« c'est le même ? »).
 *            Sur place (200 m au plus de moi), la visite compte et le lieu est à mon nom ; sinon, il
 *            est « ajouté à distance » (Uriel, 30/09 ; la base en juge, mig 393).
 * ATTENTION — l'endroit et les voisins ne se demandent qu'une fois la carte posée (moveend) ;
 *            l'épingle se soulève pendant le glissé et retombe à l'arrêt.
 */
import { maplibregl } from '@/shared/lib/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { lireCouleurs } from '@/shared/lib/couleursCarte'
import { distanceKm, type Point } from '@/shared/lib/distance'
import { positionSiAutorisee } from '@/shared/lib/position'
import { ajouterOmbrage, FOND, FRANCE, styleParchemin } from '@/shared/lib/styleCarte'
import { appliquerVue, type VueCarte } from '@/shared/lib/styleSatellite'
import { PlanSatellite } from '@/shared/ui/PlanSatellite'
import { useEndroit } from '@/shared/hooks/useEndroit'
import { useVoisins } from '../hooks/useAjout'
import { useUrlDe } from '@/shared/hooks/useUrlDe'
import { chercherEndroits, type Resultat } from '@/shared/lib/adresse'
import type { ProprietesEtape } from '../lib/brouillon'
import styles from './EtapeLieu.module.css'

const ZOOM_PROCHE = 15
const RAYON_VISITE_KM = 0.2 // le rayon de la visite en V2 (visiter_lieu)

type Origine = 'photo' | 'moi' | 'carte' | null

export function EtapeLieu({ brouillon, changer, onSuivant }: ProprietesEtape) {
  const conteneur = useRef<HTMLDivElement>(null)
  const carte = useRef<maplibregl.Map | null>(null)
  const depart = brouillon.point ?? brouillon.positionPhoto
  const [centre, setCentre] = useState<Point | null>(depart)
  const [origine, setOrigine] = useState<Origine>(
    brouillon.point ? 'carte' : brouillon.positionPhoto ? 'photo' : null,
  )
  const [moi, setMoi] = useState<Point | null>(null)
  const [enMouvement, setEnMouvement] = useState(false)
  const endroit = useEndroit(centre)
  const voisins = useVoisins(centre)
  const photo = useUrlDe(brouillon.photos[0]?.vignette)
  // La carte naît une fois, à ce point de départ : une ref, lue par l'effet sans le relancer.
  const pointDeDepart = useRef(depart)
  const [vue, setVue] = useState<VueCarte>('plan')
  const couleurs = useRef(lireCouleurs(document.documentElement))
  const premiereVue = useRef(true)

  useEffect(() => {
    if (!conteneur.current) return
    const depart = pointDeDepart.current
    const map = new maplibregl.Map({
      container: conteneur.current,
      ...(depart
        ? { center: [depart.longitude, depart.latitude] as [number, number], zoom: ZOOM_PROCHE }
        : FRANCE),
      attributionControl: { compact: true },
    })
    map.setStyle(FOND, {
      transformStyle: (_avant, fond) => styleParchemin(fond, couleurs.current),
    })
    // Permanent : « style.load » repart à chaque changement de vue (appliquerVue), et ce qui
    // dépend du style se repose alors ; l'ombrage ignore le satellite (pas de source de relief).
    map.on('style.load', () => {
      ajouterOmbrage(map, couleurs.current)
    })
    map.on('movestart', () => {
      setEnMouvement(true)
    })
    map.on('moveend', (e: { originalEvent?: unknown }) => {
      setEnMouvement(false)
      const { lat, lng } = map.getCenter()
      setCentre({ latitude: lat, longitude: lng })
      // Glissée à la main : c'est désormais la carte qui dit où.
      if (e.originalEvent) setOrigine('carte')
    })
    carte.current = map
    let fini = false
    // Ma position, si je l'ai déjà permise ; sans photo située ni point choisi, la carte part d'elle.
    void positionSiAutorisee().then((p) => {
      if (!p || fini) return
      setMoi(p)
      if (!depart) map.jumpTo({ center: [p.longitude, p.latitude], zoom: ZOOM_PROCHE })
    })
    return () => {
      fini = true
      map.remove()
      carte.current = null
    }
  }, [])

  // Plan ↔ satellite : pas au premier rendu, la carte naît déjà en plan.
  useEffect(() => {
    if (premiereVue.current) {
      premiereVue.current = false
      return
    }
    if (carte.current) appliquerVue(carte.current, vue, couleurs.current)
  }, [vue])

  const allerA = (p: Point, zoom = ZOOM_PROCHE) => {
    carte.current?.flyTo({ center: [p.longitude, p.latitude], zoom, essential: true })
  }

  const jeSuisIci = () => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const ici = { latitude: p.coords.latitude, longitude: p.coords.longitude }
        setMoi(ici)
        setOrigine('moi')
        allerA(ici, 17)
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const surPlace = moi && centre ? distanceKm(moi, centre) <= RAYON_VISITE_KM : false
  const voisin = voisins[0]

  return (
    <div className={styles.lieu}>
      <div ref={conteneur} className={styles.carte} />

      <Recherche
        onChoisir={(r) => {
          allerA(r.point, 14)
        }}
      />

      <div className={styles.vues}>
        <PlanSatellite vue={vue} onChanger={setVue} />
      </div>

      {/* L'épingle : la photo, fixe au centre de la carte. */}
      <div className={styles.epingle} data-souleve={enMouvement || undefined} aria-hidden="true">
        <span className={styles.medaillon}>{photo && <img src={photo} alt="" />}</span>
        <span className={styles.pointe} />
        <span className={styles.ombre} />
      </div>

      <section className={styles.feuille} aria-label="C’est ici ?">
        <span className={styles.poignee} aria-hidden="true" />
        {origine === 'photo' && <p className={styles.indice}>Placé d’après ta photo</p>}
        {origine === 'moi' && <p className={styles.indice}>Placé là où tu es</p>}
        <h2 className={styles.endroit}>{endroit?.titre ?? 'Déplace la carte'}</h2>
        <p className={styles.detail}>
          {[endroit?.detail, 'déplace la carte pour ajuster le point'].filter(Boolean).join(' · ')}
        </p>

        {voisin && (
          <div className={styles.voisin}>
            <span
              className={styles.bille}
              style={voisin.type?.couleur ? { '--type': voisin.type.couleur } : undefined}
              aria-hidden="true"
            />
            <span>
              <strong className={styles.voisinNom}>
                {voisin.nom} est à {Math.round(voisin.metres)} m
              </strong>
              {/* La fiche s'ouvre à la place du parcours ; le brouillon attend. */}
              <Link className={styles.voisinLien} to={`../../../lieu/${voisin.id}`} relative="path">
                C’est le même lieu ? L’ouvrir
              </Link>
            </span>
          </div>
        )}

        <div className={styles.gestes}>
          <button type="button" className={styles.ici} onClick={jeSuisIci}>
            <span className={styles.cible} aria-hidden="true" /> Je suis ici
          </button>
          <button
            type="button"
            className={styles.cestIci}
            disabled={!centre}
            onClick={() => {
              if (!centre) return
              changer({ point: centre, endroit })
              onSuivant()
            }}
          >
            C’est ici
          </button>
        </div>
        <p className={styles.visite}>
          {surPlace
            ? 'Tu es sur place : ta visite comptera, et le lieu sera à ton nom.'
            : 'Tu n’es pas sur place : le lieu sera marqué « ajouté à distance ».'}
        </p>
      </section>
    </div>
  )
}

// Chercher un endroit : les propositions arrivent une fois la frappe posée.
function Recherche({ onChoisir }: { onChoisir: (r: Resultat) => void }) {
  const [texte, setTexte] = useState('')
  const [resultats, setResultats] = useState<Resultat[]>([])

  useEffect(() => {
    const cherche = texte.trim()
    if (cherche.length < 3) return
    const abandon = new AbortController()
    const minuteur = setTimeout(() => {
      chercherEndroits(cherche, abandon.signal)
        .then(setResultats)
        .catch(() => undefined)
    }, 350)
    return () => {
      clearTimeout(minuteur)
      abandon.abort()
    }
  }, [texte])

  const montres = texte.trim().length >= 3 ? resultats : []
  return (
    <div className={styles.recherche}>
      <input
        type="search"
        className={styles.champ}
        aria-label="Chercher un endroit"
        placeholder="Une adresse, un village, un lieu-dit…"
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value)
        }}
      />
      {montres.length > 0 && (
        <ul className={styles.resultats}>
          {montres.map((r) => (
            <li key={`${r.nom}-${String(r.point.latitude)}`}>
              <button
                type="button"
                className={styles.resultat}
                onClick={() => {
                  onChoisir(r)
                  setTexte('')
                  setResultats([])
                }}
              >
                <strong>{r.nom}</strong>
                {r.contexte && <span>{r.contexte}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
