/**
 * QUOI     — le haut du profil : portrait, nom, niveau, signe, titres, présentation, Instagram,
 *            date, attache, bouton.
 * POURQUOI — ordre et valeurs de la maquette COMPTE 89:124 (le signe : 109:107). Les badges sont
 *            à droite du titre du détail (BadgesExplorateur). Chaque titre s'explique au
 *            toucher (comment il a été gagné) ; le signe veille en filigrane derrière l'en-tête.
 * ATTENTION — `attache` arrive complète de la base (« Noble représentant des Alpes-Maritimes »,
 *            article officiel INSEE) : on l'affiche telle quelle, sans la recomposer. Sa
 *            silhouette (la forme du département) se dessine en pochoir devant (migration 362).
 */
import { aLaTaille } from '@/shared/lib/image'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import murmure from '@/assets/ui/murmure.svg'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import { Text } from '@/shared/ui/Text'
import type { ExplorateurProfile, TitrePorte } from '../api/lireProfil'
import { decouperBio } from '../lib/bio'
import { phraseCondition } from '@/shared/lib/conditionTitre'
import { sousLeSigne } from '@/shared/lib/signe'
import { ProfilChiffres } from './ProfilChiffres'
import styles from './ProfilEntete.module.css'

const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })

export function ProfilEntete({ profil }: { profil: ExplorateurProfile }) {
  const navigate = useNavigate()
  // L'onglet où l'on est : le profil s'affiche dans l'écran Compte (dessiné par la coquille,
  // hors des routes de l'onglet) ou en détail d'un autre onglet. Une adresse relative
  // (« modifier ») partait de la racine sur l'écran Compte et ramenait à l'Accueil (30/09).
  const onglet = useLocation().pathname.split('/')[1] ?? 'compte'
  const [titre, setTitre] = useState<TitrePorte | null>(null)
  const signe = profil.signe && sousLeSigne(profil.signe.nom)

  return (
    <>
      <header className={styles.entete}>
        {profil.signe?.imageUrl && (
          <img className={styles.filigrane} src={aLaTaille(profil.signe.imageUrl, 320)} alt="" />
        )}

        <Avatar url={profil.avatarUrl} nom={profil.nom} taille="grand" />
        <div className={styles.identite}>
          <p className={styles.nom}>{profil.nom}</p>
          <p className={styles.niveau}>Niveau {profil.niveau}</p>
          {signe && (
            <p className={styles.signe}>
              {signe.avant}
              <b>{signe.nom}</b>
            </p>
          )}
        </div>

        {/* Les titres en une ligne, comme une devise sous le nom (maquette 123:107). */}
        {profil.titres.length > 0 && (
          <p className={styles.titres}>
            {profil.titres.map((t) => (
              <button
                key={t.id}
                type="button"
                className={styles.titre}
                onClick={() => {
                  setTitre(t)
                }}
              >
                <span className={styles.marque} aria-hidden="true">
                  ✦
                </span>
                {t.nom}
              </button>
            ))}
          </p>
        )}

        <ProfilChiffres profil={profil} />

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
              <span className={styles.iconeInstagram} aria-hidden="true" />
              {profil.instagram}
            </a>
          )}
          <p className={styles.depuis}>
            Explorateur depuis le {DATE_LONGUE.format(new Date(profil.inscritLe))}
          </p>
          {profil.attache && (
            <p className={styles.attache}>
              {profil.attache.silhouette && (
                <svg
                  className={styles.silhouette}
                  viewBox={profil.attache.silhouette.viewBox}
                  aria-hidden="true"
                >
                  <path d={profil.attache.silhouette.d} />
                </svg>
              )}
              {profil.attache.texte}
            </p>
          )}
        </div>

        <div className={styles.action}>
          {profil.estMoi ? (
            <Button
              kind="doux"
              onClick={() => {
                void navigate(`/${onglet}/explorateur/${profil.id}/modifier`)
              }}
            >
              Modifier mon profil
            </Button>
          ) : (
            <Button
              kind="doux"
              onClick={() => {
                void navigate(`/messages/murmures/${profil.id}`)
              }}
            >
              <img src={murmure} alt="" width={16} height={16} />
              Envoyer un murmure
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
