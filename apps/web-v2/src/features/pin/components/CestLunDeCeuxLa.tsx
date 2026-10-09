/**
 * QUOI     — « C'est l'un de ceux-là ? » (maquette « Pin GPS — 5 ») : les lieux à 200 m du pin.
 * POURQUOI — Uriel, 06/10 : un pin posé devant un lieu déjà sur la carte devient une visite de ce
 *            lieu, datée du pin, sans revendication. Sans lieu proche, on passe à l'ajout.
 * ATTENTION — `onAutre` part aussi tout seul quand la liste revient vide : la route le garde
 *            stable (useCallback), sinon l'effet repartirait à chaque rendu.
 *            Pin périmé (spec : « il se ferme sans visite, et l'écran le dit ») : la note le dit
 *            avant, et « Pin fermé, sans visite » après, avant d'aller au lieu.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { aLaTaille } from '@/shared/lib/image'
import { joursRestants } from '@/shared/lib/validitePin'
import { Feuille } from '@/shared/ui/Feuille'
import { fetchLieuxProches, visiterDepuisPin } from '../api/pins'
import { PINS } from '../hooks/usePins'
import styles from './CestLunDeCeuxLa.module.css'

type Props = {
  pin: string
  poseLe: Date
  onVisite: (lieu: string, visite: boolean) => void
  onAutre: () => void
  onFermer: () => void
}

const TITRE = 'C’est l’un de ceux-là ?'

export function CestLunDeCeuxLa({ pin, poseLe, onVisite, onAutre, onFermer }: Props) {
  const proches = useQuery({ queryKey: ['pins', pin, 'proches'], queryFn: () => fetchLieuxProches(pin) })
  const queryClient = useQueryClient()
  const visiter = useMutation({
    mutationFn: (lieu: string) => visiterDepuisPin(pin, lieu),
    onSuccess: (r, lieu) => {
      // Le pin se ferme : il quitte « Tes pins » et la carte tout de suite ; la visite compte
      // partout où l'ajout d'un lieu compte (mêmes clés que `usePoser`).
      void queryClient.invalidateQueries({ queryKey: PINS })
      void queryClient.invalidateQueries({ queryKey: ['carte', 'lieux'] })
      void queryClient.invalidateQueries({ queryKey: ['accueil'] })
      void queryClient.invalidateQueries({ queryKey: ['explorateur'] })
      // La fiche du lieu visité : `ficheKey` (zone lieu), en clé littérale — une zone n'en
      // importe pas une autre.
      void queryClient.invalidateQueries({ queryKey: ['lieu', lieu] })
      // Sans visite (pin périmé), l'écran le dit d'abord ; « Voir le lieu » mène ensuite au lieu.
      if (r.visite) onVisite(lieu, true)
    },
  })
  const perime = joursRestants(poseLe, new Date()) <= 0
  const vide = proches.data?.length === 0
  useEffect(() => {
    if (vide) onAutre()
  }, [vide, onAutre])

  if (proches.isError) {
    return (
      <Feuille titre={TITRE} onFermer={onFermer}>
        <p className={styles.detail}>Les lieux proches de ton pin n’ont pas pu se charger.</p>
        <button
          type="button"
          className={styles.autre}
          onClick={() => {
            void proches.refetch()
          }}
        >
          Réessayer
        </button>
      </Feuille>
    )
  }
  const lieu = visiter.variables
  if (visiter.data?.visite === false && lieu !== undefined) {
    return (
      <Feuille titre={TITRE} onFermer={onFermer}>
        <h2 className={styles.titre}>Pin fermé, sans visite</h2>
        <p className={styles.detail}>
          Ton pin avait plus de 15 jours : il est fermé, et la visite ne compte pas.
        </p>
        <button
          type="button"
          className={styles.autre}
          onClick={() => {
            onVisite(lieu, false)
          }}
        >
          Voir le lieu
        </button>
      </Feuille>
    )
  }
  if (!proches.data || vide) return null

  const jour = poseLe.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
  const combien = proches.data.length > 1 ? `${String(proches.data.length)} lieux` : 'ce lieu'
  return (
    <Feuille titre={TITRE} onFermer={onFermer}>
      <h2 className={styles.titre}>{TITRE}</h2>
      <p className={styles.detail}>
        Ton pin du {jour} est à moins de 200 m de {combien} déjà sur la carte.
      </p>
      {proches.data.map((l) => (
        <div key={l.id} className={styles.lieu}>
          {l.imageUrl ? (
            <img className={styles.photo} src={aLaTaille(l.imageUrl, 48)} alt="" />
          ) : (
            <span className={styles.photo} aria-hidden="true" />
          )}
          <span className={styles.texte}>
            <strong className={styles.nom}>{l.nom}</strong>
            <span className={styles.distance}>à {Math.round(l.metres)} m de ton pin</span>
          </span>
          <button
            type="button"
            className={styles.cestLui}
            aria-label={`C’est lui : ${l.nom}`}
            disabled={visiter.isPending}
            onClick={() => {
              visiter.mutate(l.id)
            }}
          >
            C’est lui
          </button>
        </div>
      ))}
      <button type="button" className={styles.autre} onClick={onAutre}>
        Non, c’est un autre lieu
      </button>
      {visiter.isError && (
        <p className={styles.erreur} role="alert">
          La visite n’a pas pu compter. Réessaie.
        </p>
      )}
      <p className={styles.note}>
        {perime
          ? 'Ton pin a plus de 15 jours : « C’est lui » le ferme sans compter de visite.'
          : '« C’est lui » compte ta visite, datée du jour de ton pin.'}
      </p>
    </Feuille>
  )
}
