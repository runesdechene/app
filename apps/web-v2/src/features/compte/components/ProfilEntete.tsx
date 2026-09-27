/**
 * QUOI     — le haut du profil : badges, portrait, nom, niveau, titres, présentation, attache.
 * POURQUOI — ordre de la maquette 89:124. « Porteur vérifié » s'explique au toucher : c'est un
 *            client, il porte au moins un Fragment (décision d'Uriel, 27/09).
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
import type { ExplorateurProfile } from '../api/lireProfil'
import { decouperBio } from '../lib/bio'
import styles from './ProfilEntete.module.css'

const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })
const ROLES = { admin: 'Admin', moderator: 'Modérateur' } as const

export function ProfilEntete({ profil }: { profil: ExplorateurProfile }) {
  const navigate = useNavigate()
  const [explication, setExplication] = useState(false)

  return (
    <header className={styles.entete}>
      <div className={styles.badges}>
        {profil.porteurVerifie && (
          <button
            type="button"
            className={styles.verifie}
            onClick={() => {
              setExplication(true)
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
      </div>

      {profil.titres.length > 0 && (
        <div className={styles.titres}>
          {profil.titres.map((t) => (
            <PastilleChoix key={t.id} libelle={t.nom} />
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

      {explication && (
        <Feuille
          titre="Porteur vérifié"
          onFermer={() => {
            setExplication(false)
          }}
        >
          <Text variant="titre-carte">Porteur vérifié</Text>
          <Text variant="corps">
            {profil.nom} porte au moins un Fragment Runes de Chêne : c’est un client de la marque.
          </Text>
        </Feuille>
      )}
    </header>
  )
}
