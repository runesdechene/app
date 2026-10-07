/**
 * QUOI     — le panneau « Tous les titres » (maquette 112:107) : le compte, puis un bloc par chemin
 *            vivant (les titres par seuil, le prochain avec sa barre, les portés cerclés). Les titres
 *            de l'ancien jeu sont partis avec la V1 (Uriel, 06/10 — migration 433).
 * POURQUOI — aucun endroit ne montrait les titres qu'on peut gagner (Uriel, 06/10). La base range ;
 *            ici, on montre.
 */
import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import type { Chemin, TitreDuChemin } from '../api/lireMesTitres'
import { useMesTitres } from '../hooks/useMesTitres'
import { compteurEnClair, nomDuChemin, prochain, progresEnClair } from '../lib/chemins'
import { Barre, FeuilleTitre, type TitreTouche } from './FeuilleTitre'
import styles from './PageTitres.module.css'

export function PageTitres() {
  const { titres, erreur, reessayer } = useMesTitres()
  const [touche, setTouche] = useState<TitreTouche | null>(null)

  if (erreur) {
    return (
      <div className={styles.etat}>
        <EmptyState>Tes titres n’ont pas pu être chargés</EmptyState>
        <Button kind="doux" onClick={() => void reessayer()}>
          Réessayer
        </Button>
      </div>
    )
  }
  if (!titres) return <div className={styles.chargement} aria-busy="true" />

  return (
    <div className={styles.page}>
      <div className={styles.resume}>
        <p className={styles.compte}>
          <span className={styles.nombre}>{titres.obtenus}</span>
          <span>{`titres obtenus sur ${String(titres.total)}`}</span>
        </p>
        <p className={styles.aide}>
          Touche un titre pour savoir comment il se gagne. Tu en portes trois sur ton profil.
        </p>
      </div>

      {titres.chemins.map((chemin) => (
        <BlocChemin key={chemin.stat} chemin={chemin} onToucher={setTouche} />
      ))}

      {touche && (
        <FeuilleTitre
          titre={touche}
          onFermer={() => {
            setTouche(null)
          }}
        />
      )}
    </div>
  )
}

function BlocChemin({
  chemin,
  onToucher,
}: {
  chemin: Chemin
  onToucher: (t: TitreTouche) => void
}) {
  const suivant = prochain(chemin)
  const nom = nomDuChemin(chemin.stat)
  const toucher = (t: TitreDuChemin) => {
    onToucher({
      nom: t.nom,
      cas: t.obtenu ? 'obtenu' : 'a-gagner',
      condition: { stat: chemin.stat, min: t.min },
      compteur: chemin.compteur,
    })
  }
  return (
    <section className={styles.chemin} aria-label={nom}>
      <header className={styles.entete}>
        <h2 className={styles.nomChemin}>{nom}</h2>
        <span className={styles.compteur}>{compteurEnClair(chemin.stat, chemin.compteur)}</span>
      </header>
      <ul className={styles.titres}>
        {chemin.titres.map((t) => (
          <li key={t.id} className={styles.ligne}>
            <Gelule
              nom={t.nom}
              obtenu={t.obtenu}
              porte={t.porte}
              onToucher={() => {
                toucher(t)
              }}
            />
            {t === suivant ? (
              <div className={styles.progres}>
                <span className={styles.seuil}>
                  {progresEnClair(chemin.stat, chemin.compteur, t.min)}
                </span>
                <Barre valeur={chemin.compteur} max={t.min} nom={t.nom} />
              </div>
            ) : (
              <span className={styles.seuil}>{compteurEnClair(chemin.stat, t.min)}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Gelule({
  nom,
  obtenu,
  porte,
  onToucher,
}: {
  nom: string
  obtenu: boolean
  porte: boolean
  onToucher: () => void
}) {
  return (
    <button
      type="button"
      className={styles.gelule}
      data-obtenu={obtenu || undefined}
      data-porte={porte || undefined}
      onClick={onToucher}
    >
      <span className={styles.marque} aria-hidden="true">
        ✦
      </span>
      {nom}
      {porte && <span className={styles.porte}> · sur ton profil</span>}
      <span className={styles.pourLecteur}>{obtenu ? ' · obtenu' : ' · à gagner'}</span>
    </button>
  )
}
