/**
 * QUOI     — la page du classement, ouverte dans le tiroir par « Voir tout le classement » : le
 *            choix (lieux visités ou ajoutés, ce mois-ci ou depuis toujours) et toute la liste —
 *            les cinquante premiers (mig 379), puis ma place.
 * POURQUOI — une page et non une modale (Uriel, 29/09) : elle a son adresse, /accueil/classement,
 *            et le retour du navigateur la referme.
 */
import { useState } from 'react'
import { PastilleChoix } from '@/shared/ui/PastilleChoix'
import { Segments } from '@/shared/ui/Segments'
import type { Periode, TypeDeClassement } from '../api/lireAccueil'
import { useGrandsExplorateurs } from '../hooks/useAccueil'
import { Classement } from './Classement'
import styles from './PageClassement.module.css'

const TYPES = [
  { id: 'visites', libelle: 'Visités' },
  { id: 'ajouts', libelle: 'Ajoutés' },
] as const
const PERIODES: { id: Periode; libelle: string }[] = [
  { id: '30jours', libelle: '30 derniers jours' },
  { id: 'toujours', libelle: 'Depuis toujours' },
]

export function PageClassement() {
  const [type, setType] = useState<TypeDeClassement>('visites')
  const [periode, setPeriode] = useState<Periode>('30jours')
  const classement = useGrandsExplorateurs(type, periode)
  return (
    <div className={styles.page}>
      <div className={styles.choix}>
        <Segments libelle="Classement" options={TYPES} valeur={type} onChange={setType} />
        <div className={styles.periodes} role="group" aria-label="Période">
          {PERIODES.map((p) => (
            <PastilleChoix
              key={p.id}
              libelle={p.libelle}
              choisie={periode === p.id}
              onClick={() => {
                setPeriode(p.id)
              }}
            />
          ))}
        </div>
      </div>
      {classement &&
        (classement.tete.length === 0 ? (
          <p className={styles.vide}>
            {periode === '30jours'
              ? 'Personne ces 30 derniers jours : à toi d’ouvrir la marche.'
              : 'Personne encore : à toi d’ouvrir la marche.'}
          </p>
        ) : (
          <Classement
            classement={classement}
            type={type}
            lignes={classement.tete.length}
            avecMaPlace
          />
        ))}
    </div>
  )
}
