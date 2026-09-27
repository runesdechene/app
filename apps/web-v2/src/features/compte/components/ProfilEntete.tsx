/**
 * QUOI     — le haut du profil : badges, portrait, nom, niveau, signe, titres, présentation,
 *            attache.
 * POURQUOI — ordre de la maquette 89:124 (et 109:107 pour le signe). Deux explications au
 *            toucher (décisions d'Uriel, 27/09) : « Porteur vérifié » (c'est un client) et chaque
 *            titre (comment il a été gagné). Le signe : l'illustration du Fragment choisi veille
 *            en filigrane derrière l'en-tête.
 * ATTENTION — `attache` arrive complète de la base (« Noble représentant des Alpes-Maritimes »,
 *            article officiel INSEE) : on l'affiche telle quelle, sans la recomposer.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router'
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
const ROLES = { admin: 'Admin', moderator: 'Modérateur' } as const

export function ProfilEntete({ profil }: { profil: ExplorateurProfile }) {
  const navigate = useNavigate()
  const [explication, setExplication] = useState<'porteur' | TitrePorte | null>(null)
  const fermer = () => {
    setExplication(null)
  }

  return (
    <header className={styles.entete}>
      {profil.signe?.imageUrl && (
        <img className={styles.filigrane} src={profil.signe.imageUrl} alt="" />
      )}

      <div className={styles.badges}>
        {profil.porteurVerifie && (
          <button
            type="button"
            className={styles.verifie}
            onClick={() => {
              setExplication('porteur')
            }}
          >
            ✓ Porteur vérifié
          </button>
        )}
        {profil.role && <span className={styles.role}>{ROLES[profil.role]}</span>}
      </div>

      <Avatar url={profil.avatarUrl} nom={profil.nom} taille="grand" />
      <div className={styles.identite}>
        <Text variant="titre-ecran" as="p">
          {profil.nom}
        </Text>
        <Text variant="rubrique" as="p">
          Niveau {profil.niveau}
        </Text>
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
                setExplication(t)
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
        <Text variant="legende">
          Explorateur depuis le {DATE_LONGUE.format(new Date(profil.inscritLe))}
        </Text>
        {profil.attache && <Text variant="sous-titre">{profil.attache}</Text>}
      </div>

      <div className={styles.action}>
        {profil.estMoi ? (
          <Button
            kind="secondaire"
            onClick={() => {
              void navigate('modifier')
            }}
          >
            Modifier mon profil
          </Button>
        ) : (
          <Button kind="secondaire" disabled>
            Envoyer un murmure (bientôt)
          </Button>
        )}
      </div>

      {explication === 'porteur' && (
        <Feuille titre="Porteur vérifié" onFermer={fermer}>
          <Text variant="titre-carte">Porteur vérifié</Text>
          <Text variant="corps">
            {profil.nom} porte au moins un Fragment Runes de Chêne : c’est un client de la marque.
          </Text>
        </Feuille>
      )}
      {explication !== null && explication !== 'porteur' && (
        <Feuille titre={explication.nom} onFermer={fermer}>
          <p className={styles.marqueGrande} aria-hidden="true">
            ✦
          </p>
          <Text variant="titre-carte">{explication.nom}</Text>
          <Text variant="sous-titre">Titre gagné en jouant</Text>
          <Text variant="corps">{phraseCondition(explication.condition)}</Text>
        </Feuille>
      )}
    </header>
  )
}
