/**
 * QUOI     — le haut du profil : portrait, nom, niveau, signe, titres, présentation, Instagram,
 *            date, attache, bouton.
 * POURQUOI — ordre et valeurs de la maquette COMPTE 89:124 (le signe : 109:107). Les badges sont
 *            à droite du titre du détail (BadgesExplorateur). Chaque titre s'explique au
 *            toucher (comment il a été gagné) ; le signe veille en filigrane derrière l'en-tête.
 * ATTENTION — `attache` arrive complète de la base (« Noble représentant des Alpes-Maritimes »,
 *            article officiel INSEE) : on l'affiche telle quelle, sans la recomposer.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router'
import murmure from '@/assets/ui/murmure.svg'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import { PastilleChoix } from '@/shared/ui/PastilleChoix'
import { Text } from '@/shared/ui/Text'
import type { ExplorateurProfile, TitrePorte } from '../api/lireProfil'
import { decouperBio } from '../lib/bio'
import { phraseCondition } from '../lib/conditionTitre'
import { sousLeSigne } from '../lib/signe'
import styles from './ProfilEntete.module.css'

const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })

export function ProfilEntete({ profil }: { profil: ExplorateurProfile }) {
  const navigate = useNavigate()
  const [titre, setTitre] = useState<TitrePorte | null>(null)

  return (
    <>
      <header className={styles.entete}>
        {profil.signe?.imageUrl && (
          <img className={styles.filigrane} src={profil.signe.imageUrl} alt="" />
        )}

        <Avatar url={profil.avatarUrl} nom={profil.nom} taille="grand" />
        <div className={styles.identite}>
          <p className={styles.nom}>{profil.nom}</p>
          <p className={styles.niveau}>Niveau {profil.niveau}</p>
          {profil.signe && <p className={styles.signe}>{sousLeSigne(profil.signe.nom)}</p>}
        </div>

        {profil.titres.length > 0 && (
          <div className={styles.titres}>
            {profil.titres.map((t) => (
              <button
                key={t.id}
                type="button"
                className={styles.titre}
                onClick={() => {
                  setTitre(t)
                }}
              >
                <PastilleChoix libelle={t.nom} marque="✦" />
              </button>
            ))}
          </div>
        )}

        {profil.bio && (
          <p className={styles.bio}>
            {decouperBio(profil.bio).map((m, i) =>
              m.type === 'lien' ? (
                <a key={i} href={m.href} target="_blank" rel="noreferrer">
                  {m.valeur}
                </a>
              ) : (
                m.valeur
              ),
            )}
          </p>
        )}

        <div className={styles.details}>
          {profil.instagram && (
            <a
              className={styles.instagram}
              href={`https://www.instagram.com/${profil.instagram}/`}
              target="_blank"
              rel="noreferrer"
            >
              @{profil.instagram}
            </a>
          )}
          <p className={styles.depuis}>
            Explorateur depuis le {DATE_LONGUE.format(new Date(profil.inscritLe))}
          </p>
          {profil.attache && <p className={styles.attache}>{profil.attache}</p>}
        </div>

        <div className={styles.action}>
          {profil.estMoi ? (
            <Button
              kind="doux"
              onClick={() => {
                void navigate('modifier')
              }}
            >
              Modifier mon profil
            </Button>
          ) : (
            <Button kind="doux" disabled>
              <img src={murmure} alt="" width={16} height={16} />
              Envoyer un murmure (bientôt)
            </Button>
          )}
        </div>
      </header>

      {/* Hors de l'en-tête : il est positionné pour le filigrane, la feuille doit couvrir l'écran. */}
      {titre && (
        <Feuille
          titre={titre.nom}
          onFermer={() => {
            setTitre(null)
          }}
        >
          <div className={styles.explication}>
            <p className={styles.marqueGrande} aria-hidden="true">
              ✦
            </p>
            <Text variant="titre-carte">{titre.nom}</Text>
            <Text variant="sous-titre">Titre gagné en jouant</Text>
            <Text variant="corps">{phraseCondition(titre.condition)}</Text>
          </div>
        </Feuille>
      )}
    </>
  )
}
