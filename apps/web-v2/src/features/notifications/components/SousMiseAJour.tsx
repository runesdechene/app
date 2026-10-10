/**
 * QUOI     — sous une mise à jour (mig 478) : ses cœurs à volonté, puis son carnet — les mêmes
 *            briques que sous un lieu. Repliée (une note précédente), elle montre ses comptes et
 *            « Lire les commentaires ».
 * POURQUOI — Uriel, 11/10 : réagir aux mises à jour et les commenter, « tout pareil » qu'un lieu.
 *            Sur sa propre note, la pastille montre les cœurs et ouvre la liste de ceux qui en ont
 *            envoyé, comme sur son propre lieu.
 * ATTENTION — repliée, rien ne se charge : le carnet attend qu'on l'ouvre, la liste des cœurs
 *            qu'on ouvre sa feuille.
 */
import { useState } from 'react'
import { Carnet } from '@/shared/ui/Carnet'
import { FeuilleDesCoeurs } from '@/shared/ui/FeuilleDesCoeurs'
import { PastilleCoeurs } from '@/shared/ui/PastilleCoeurs'
import type { MiseAJour } from '../api/nouveautes'
import { useCarnetDeMiseAJour } from '../hooks/useCarnetDeMiseAJour'
import { useCoeursDeMiseAJour } from '../hooks/useCoeursDeMiseAJour'
import styles from './SousMiseAJour.module.css'

const pluriel = (n: number) => `${String(n)} ${n > 1 ? 'mots' : 'mot'}`

export function SousMiseAJour({
  miseAJour: m,
  depliee = false,
}: {
  miseAJour: MiseAJour
  depliee?: boolean
}) {
  const [ouverte, setOuverte] = useState(depliee)
  const [feuille, setFeuille] = useState(false)
  const coeurs = useCoeursDeMiseAJour(m.id, feuille)
  const { carnet, ecrire, aimer, effacer } = useCarnetDeMiseAJour(m.id, ouverte)

  if (!ouverte) {
    return (
      <div className={styles.repliee}>
        {m.coeurs > 0 && (
          <span className={styles.compte}>
            <span className={styles.coeur} aria-hidden="true" />
            {m.coeurs}
          </span>
        )}
        {m.mots > 0 && <span className={styles.compte}>{pluriel(m.mots)}</span>}
        <button
          type="button"
          className={styles.lire}
          onClick={() => {
            setOuverte(true)
          }}
        >
          Lire les commentaires
        </button>
      </div>
    )
  }

  return (
    <div className={styles.ouverte}>
      <PastilleCoeurs
        coeurs={{ total: m.coeurs, miens: m.miens, gens: [] }}
        peutAimer={!m.aMoi}
        onAimer={coeurs.aimer}
        onVoir={() => {
          setFeuille(true)
        }}
      />
      {carnet && (
        <Carnet
          carnet={carnet}
          actions={{
            ecrire: ecrire.mutate,
            enCours: ecrire.isPending,
            erreur: ecrire.error,
            aimer,
            effacer,
          }}
          titre="Commentaires"
          chapo="Ce que les Explorateurs en pensent…"
          indication="Dis ce que tu en penses…"
        />
      )}
      {feuille && (
        <FeuilleDesCoeurs
          coeurs={coeurs.gens}
          onFermer={() => {
            setFeuille(false)
          }}
        />
      )}
    </div>
  )
}
