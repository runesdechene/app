/**
 * QUOI     — poser un pin GPS : ma position, sa précision, « Poser mon pin ici » ; puis « Pin posé »
 *            (maquettes « Pin GPS — 1, 1b, 2, 2b »).
 * POURQUOI — Uriel, 06/10 : le pin ne garde qu'une position, en deux appuis (un appui raté ne pose
 *            rien), même sans réseau ; les photos se prennent avec le téléphone. Au-delà de
 *            ± 200 m, on ne pose pas. Le délai de 15 jours se dit avant de poser.
 * ATTENTION — hors ligne, le fond de carte ne charge pas : l'écran le dit (2b).
 */
import { maplibregl } from '@/shared/lib/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { useEndroit } from '@/shared/hooks/useEndroit'
import { lireCouleurs } from '@/shared/lib/couleursCarte'
import { appliquerVue, type VueCarte } from '@/shared/lib/styleSatellite'
import { ajouterOmbrage, FOND, styleParchemin } from '@/shared/lib/styleCarte'
import { VALIDITE_JOURS } from '@/shared/lib/validitePin'
import { useEnLigne } from '@/shared/hooks/useEnLigne'
import { PRECISION_MAX_M, usePositionPrecise } from '@/shared/hooks/usePositionPrecise'
import { PlanSatellite } from '@/shared/ui/PlanSatellite'
import { usePoserPin } from '../hooks/usePins'
import styles from './PoserPin.module.css'

const ZOOM = 16

export function PoserPin({ onFermer }: { onFermer: () => void }) {
  const position = usePositionPrecise()
  const enLigne = useEnLigne()
  const poser = usePoserPin()
  const [vue, setVue] = useState<VueCarte>('plan')
  const conteneur = useRef<HTMLDivElement>(null)
  const carte = useRef<maplibregl.Map | null>(null)
  const couleurs = useRef(lireCouleurs(document.documentElement))
  const point = position.etat === 'trouvee' ? position.point : null
  const endroit = useEndroit(enLigne ? point : null)

  useEffect(() => {
    if (!conteneur.current || !enLigne) return
    const map = new maplibregl.Map({
      container: conteneur.current,
      center: [2.4, 46.6],
      zoom: 5,
      attributionControl: { compact: true },
    })
    map.setStyle(FOND, { transformStyle: (_avant, fond) => styleParchemin(fond, couleurs.current) })
    // Permanent : « style.load » repart à chaque changement de vue ; l'ombrage ignore le satellite.
    map.on('style.load', () => {
      ajouterOmbrage(map, couleurs.current)
    })
    carte.current = map
    return () => {
      map.remove()
      carte.current = null
    }
  }, [enLigne])

  useEffect(() => {
    if (point) carte.current?.jumpTo({ center: [point.longitude, point.latitude], zoom: ZOOM })
  }, [point])

  const changerVue = (v: VueCarte) => {
    setVue(v)
    if (carte.current) appliquerVue(carte.current, v, couleurs.current)
  }

  const precis = position.etat === 'trouvee' && position.precision <= PRECISION_MAX_M
  const metres = position.etat === 'trouvee' ? Math.round(position.precision) : null

  return (
    <div className={styles.poser}>
      <header className={styles.entete}>
        <button type="button" className={styles.fermer} onClick={onFermer} aria-label="Fermer" />
        <p className={styles.titreEcran}>{poser.isSuccess ? 'Pin posé' : 'Poser un pin'}</p>
      </header>

      {enLigne ? (
        <div ref={conteneur} className={styles.carte} />
      ) : (
        <p className={styles.horsLigne}>Pas de réseau : la carte reviendra avec lui.</p>
      )}
      {enLigne && (
        <div className={styles.vues}>
          <PlanSatellite vue={vue} onChanger={changerVue} />
        </div>
      )}
      <span className={styles.repere} aria-hidden="true" />

      <section className={styles.feuille} aria-label="Ton pin">
        <span className={styles.poignee} aria-hidden="true" />
        {poser.isSuccess ? (
          <>
            <p className={styles.indice}>✓ Posé{enLigne ? '' : ' · dans ton téléphone'}</p>
            <h2 className={styles.endroit}>
              {enLigne ? (endroit?.titre ?? 'Ton pin est posé') : 'Ton pin est posé'}
            </h2>
            <p className={styles.detail}>
              {enLigne
                ? `encore ${String(VALIDITE_JOURS)} jours pour le compléter`
                : 'Pas de réseau : il partira tout seul dès qu’il revient.'}
            </p>
            <div className={styles.encadre}>
              <strong>Prends tes photos avec ton téléphone</strong>
              <span>Tu les choisiras dans ta galerie en complétant le lieu.</span>
            </div>
            <button type="button" className={styles.principal} onClick={onFermer}>
              C’est tout
            </button>
            <p className={styles.note}>Tu le retrouveras dans « + » et sur ta carte.</p>
          </>
        ) : position.etat === 'refusee' ? (
          <>
            <h2 className={styles.endroit}>Où es-tu ?</h2>
            <p className={styles.detail}>
              Autorise la localisation pour cette app dans les réglages de ton téléphone, puis reviens.
            </p>
          </>
        ) : (
          <>
            <p className={styles.indice} data-imprecis={(metres !== null && !precis) || undefined}>
              {metres === null
                ? '⌖ Recherche du GPS…'
                : precis
                  ? `⌖ GPS précis à ± ${String(metres)} m`
                  : `⌖ GPS imprécis : ± ${String(metres)} m`}
            </p>
            <h2 className={styles.endroit}>{endroit?.titre ?? 'Ta position'}</h2>
            <p className={styles.detail}>
              {[endroit?.detail, 'ta position, maintenant'].filter(Boolean).join(' · ')}
            </p>
            <div className={styles.encadre}>
              <strong>Tu auras {VALIDITE_JOURS} jours pour le compléter</strong>
              <span>en gardant « sur place » : ta visite et ta revendication.</span>
            </div>
            <button
              type="button"
              className={styles.principal}
              disabled={!precis || poser.isPending}
              onClick={() => {
                if (position.etat === 'trouvee' && precis) {
                  poser.mutate({ point: position.point, precision: position.precision })
                }
              }}
            >
              {metres !== null && !precis
                ? `GPS trop imprécis (± ${String(metres)} m)`
                : 'Poser mon pin ici'}
            </button>
            <p className={styles.note}>
              {metres !== null && !precis
                ? 'Attends un instant, à découvert si tu peux : il faut ± 200 m au plus.'
                : 'Poser ne rapporte rien : tout se joue quand tu le complètes.'}
            </p>
          </>
        )}
      </section>
    </div>
  )
}
