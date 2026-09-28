/**
 * QUOI     — la fiche d'un lieu, dans l'ordre de la maquette 229:128 : photo au bord déchiré,
 *            galerie, titre et ses deux boutons ronds, type, ligne de faits, adresse, Explorateurs,
 *            revendication, bouton de visite, récit, crédits.
 * POURQUOI — spec fiche §2 : chaque ligne sans donnée disparaît, jamais une ligne vide ; la fiche
 *            ne connaît ni la coquille ni les feuilles — la route les lui passe.
 * ATTENTION — `boutonVisite` est une fonction : le bouton a besoin de la fiche chargée.
 */
import { useState, type ReactNode } from 'react'
import drapeau from '@/assets/ui/drapeau.svg'
import epingle from '@/assets/ui/epingle.svg'
import etoiles from '@/assets/ui/etoiles.svg'
import options from '@/assets/ui/options.svg'
import partager from '@/assets/ui/partager.svg'
import pas from '@/assets/ui/pas.svg'
import signetPlein from '@/assets/ui/signet-plein.svg'
import signet from '@/assets/ui/signet.svg'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import type { FicheLieu as Fiche } from '../api/lireLieu'
import { useEnvie } from '../hooks/useEnvie'
import { useFiche } from '../hooks/useFiche'
import { adresseCourte } from '../lib/adresse'
import { ligneDeFaits } from '../lib/faits'
import styles from './FicheLieu.module.css'

const DEPUIS = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const LE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

function phraseExplorateurs(nombre: number) {
  if (nombre === 0) return 'Personne n’a encore foulé ce lieu'
  if (nombre === 1) return '1 Explorateur a foulé ce lieu'
  return `${String(nombre)} Explorateurs ont foulé ce lieu`
}

export function FicheLieu({
  id,
  onOptions,
  onPartager,
  boutonVisite,
}: {
  id: string
  onOptions: () => void
  onPartager: () => void
  boutonVisite: (fiche: Fiche) => ReactNode
}) {
  const { fiche, erreur, reessayer } = useFiche(id)
  const { basculer, echec } = useEnvie(id)
  const [grande, setGrande] = useState(0)

  if (erreur) {
    return (
      <div className={styles.etat}>
        <EmptyState>La fiche n’a pas pu être chargée</EmptyState>
        <Button kind="doux" onClick={reessayer}>
          Réessayer
        </Button>
      </div>
    )
  }
  if (fiche === undefined) return <div className={styles.chargement} aria-busy="true" />
  if (fiche === null) return <EmptyState>Ce lieu n’existe pas ou n’est plus visible</EmptyState>

  const photo = fiche.photos[grande] ?? fiche.photos[0]
  const faits = ligneDeFaits(fiche.faits)
  const itineraire = `https://www.google.com/maps/dir/?api=1&destination=${String(fiche.lat)},${String(fiche.lng)}`

  return (
    <article className={styles.fiche}>
      <div className={styles.photo}>
        {photo ? (
          <img className={styles.image} src={photo.url} alt="" />
        ) : (
          fiche.type?.icone && (
            <span className={styles.sansPhoto} style={{ '--icone': `url(${fiche.type.icone})` }} />
          )
        )}
        <button
          type="button"
          className={styles.partager}
          aria-label="Partager"
          onClick={onPartager}
        >
          <img src={partager} alt="" />
        </button>
      </div>

      <div className={styles.corps}>
        {fiche.photos.length > 1 && (
          <div className={styles.galerie}>
            {fiche.photos.map((p, i) => (
              <button
                key={p.url}
                type="button"
                className={styles.vignette}
                aria-label={`Photo ${String(i + 1)}`}
                aria-pressed={i === grande}
                onClick={() => {
                  setGrande(i)
                }}
              >
                <img src={p.vignette} alt="" />
              </button>
            ))}
          </div>
        )}

        <div className={styles.entete}>
          <h2 className={styles.nom}>{fiche.nom}</h2>
          <button
            type="button"
            className={styles.rond}
            aria-label="Envie d’y aller"
            aria-pressed={fiche.moi.envie}
            onClick={basculer}
          >
            <img src={fiche.moi.envie ? signetPlein : signet} alt="" />
          </button>
          <button
            type="button"
            className={styles.rond}
            aria-label="Options du lieu"
            onClick={onOptions}
          >
            <img src={options} alt="" />
          </button>
        </div>
        {echec && (
          <p role="alert" className={styles.alerte}>
            L’envie n’a pas pu être enregistrée. Réessaie dans un instant.
          </p>
        )}

        {fiche.type && (
          <p
            className={styles.badge}
            style={fiche.type.couleur ? { '--type': fiche.type.couleur } : undefined}
          >
            {fiche.type.icone && (
              <span
                className={styles.badgeIcone}
                style={{ '--icone': `url(${fiche.type.icone})` }}
              />
            )}
            {fiche.type.nom}
          </p>
        )}
        {faits && <p className={styles.faits}>{faits}</p>}

        <a className={styles.ligne} href={itineraire} target="_blank" rel="noreferrer">
          <img className={styles.icone} src={epingle} alt="" />
          <span className={styles.adresse}>
            <span className={styles.adresseTexte}>
              {fiche.adresse ? adresseCourte(fiche.adresse) : 'Ouvrir l’itinéraire'}
            </span>
            <span className={styles.aide}>Toucher l’adresse pour ouvrir le GPS</span>
          </span>
        </a>

        <p className={styles.ligne}>
          <img className={styles.icone} src={pas} alt="" />
          {fiche.explorateurs.derniers.length > 0 && (
            <span className={styles.avatars}>
              {fiche.explorateurs.derniers.map((p) => (
                <Avatar key={p.id} url={p.avatar} nom={p.nom} taille="mini" />
              ))}
            </span>
          )}
          {phraseExplorateurs(fiche.explorateurs.nombre)}
        </p>

        {fiche.revendication && (
          <p className={styles.ligne}>
            <img className={styles.icone} src={drapeau} alt="" />
            Revendiqué par
            <span className={fiche.revendication.moi ? styles.piluleMoi : styles.pilule}>
              {fiche.revendication.nom}
            </span>
            <span className={styles.depuis}>
              · depuis le {DEPUIS.format(new Date(fiche.revendication.depuis))}
            </span>
          </p>
        )}

        <div className={styles.visite}>{boutonVisite(fiche)}</div>

        {fiche.recit && (
          <section className={styles.recit} aria-label="Le récit">
            <h3 className={styles.rubrique}>Le récit</h3>
            <p className={styles.texte}>{fiche.recit}</p>
          </section>
        )}

        <footer className={styles.credits}>
          {fiche.auteur && (
            <p className={styles.credit}>
              <Avatar url={fiche.auteur.avatar} nom={fiche.auteur.nom} taille="mini" />
              <span>
                Lieu ajouté par <strong className={styles.nomCredit}>{fiche.auteur.nom}</strong>
                <img className={styles.etoiles} src={etoiles} alt="" />
                <span className={styles.date}>le {LE.format(new Date(fiche.ajouteLe))}</span>
              </span>
            </p>
          )}
          {fiche.enrichiPar && (
            <p className={styles.credit}>
              <Avatar url={null} nom={fiche.enrichiPar.nom} taille="mini" />
              <span>
                Enrichi par <strong>{fiche.enrichiPar.nom}</strong>
              </span>
            </p>
          )}
        </footer>
      </div>
    </article>
  )
}
