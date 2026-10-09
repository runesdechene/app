/**
 * QUOI     — la fiche d'un lieu, dans l'ordre de la maquette 229:128 : photos au bord déchiré
 *            (qu'on fait défiler, 02/10),
 *            galerie, titre et ses deux boutons ronds, type, ligne de faits, adresse, Explorateurs,
 *            revendication, bouton de visite, le récit, les infos en plus (accès, quand y aller, bon à
 *            savoir, bivouac), « Enrichir la fiche », puis les crédits : « Lieu ajouté par… » et, si
 *            d'autres l'ont écrit, « Récit enrichi par… » (Uriel, 05/10). Les cœurs (30/09) : la pastille à droite de
 *            la galerie, « Féliciter » sous les crédits ; puis le Carnet de passage.
 * POURQUOI — spec fiche §2 : chaque ligne sans donnée disparaît, jamais une ligne vide ; la fiche
 *            ne connaît ni la coquille ni les feuilles — la route les lui passe.
 * ATTENTION — `boutonVisite` est une fonction : le bouton a besoin de la fiche chargée.
 */
import { aLaTaille } from '@/shared/lib/image'
import { Link } from 'react-router'
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import acces from '@/assets/ui/acces.svg'
import bivouacIcone from '@/assets/ui/bivouac.svg'
import bonASavoir from '@/assets/ui/bon-a-savoir.svg'
import drapeau from '@/assets/ui/drapeau.svg'
import epingle from '@/assets/ui/epingle.svg'
import etoiles from '@/assets/ui/etoiles.svg'
import options from '@/assets/ui/options.svg'
import partager from '@/assets/ui/partager.svg'
import pas from '@/assets/ui/pas.svg'
import quand from '@/assets/ui/quand.svg'
import signetPlein from '@/assets/ui/signet-plein.svg'
import signet from '@/assets/ui/signet.svg'
import { Avatar } from '@/shared/ui/Avatar'
import { DefilePhotos } from './DefilePhotos'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import type { FicheLieu as Fiche } from '../api/lireLieu'
import { useCoeurs } from '../hooks/useCoeurs'
import { useEnvie } from '../hooks/useEnvie'
import { useFiche } from '../hooks/useFiche'
import { useMoi } from '../hooks/useMoi'
import { adresseCourte } from '../lib/adresse'
import { enrichisseurs, liaison } from '../lib/credit'
import { ligneDeFaits } from '../lib/faits'
import { Carnet } from './Carnet'
import { CoeursDesAuteurs, PastilleCoeurs } from './CoeursLieu'
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
  onCoeurs,
  onEnrichir,
  boutonVisite,
}: {
  id: string
  onOptions: () => void
  onPartager: () => void
  onCoeurs: () => void
  onEnrichir: () => void
  boutonVisite: (fiche: Fiche) => ReactNode
}) {
  const { fiche, erreur, reessayer } = useFiche(id)
  const { basculer, echec } = useEnvie(id)
  const { coeurs, aimer } = useCoeurs(id)
  const moi = useMoi()
  const [grande, setGrande] = useState(0)
  // La photo change (au doigt, aux flèches) : sa vignette se range dans la partie visible.
  const galerie = useRef<HTMLDivElement>(null)
  useEffect(() => {
    galerie.current?.children[grande]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [grande])

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

  const faits = ligneDeFaits(fiche.faits)
  const enrichi = enrichisseurs(fiche.recitPar, fiche.auteur?.id ?? null)
  // On ne s'envoie pas de cœurs sur son propre lieu (la base le refuse aussi).
  const peutAimer = moi !== undefined && moi.id !== fiche.auteur?.id
  const itineraire = `https://www.google.com/maps/dir/?api=1&destination=${String(fiche.lat)},${String(fiche.lng)}`

  return (
    <article className={styles.fiche}>
      <div className={styles.photo}>
        {fiche.photos.length > 0 ? (
          <DefilePhotos photos={fiche.photos} active={grande} onChoisir={setGrande} />
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
        <div className={styles.haut}>
          {fiche.photos.length > 1 && (
            <div ref={galerie} className={styles.galerie}>
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
                  <img src={aLaTaille(p.vignette, 33)} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
          {coeurs && moi && (
            <PastilleCoeurs
              coeurs={coeurs}
              peutAimer={peutAimer}
              onAimer={aimer}
              onVoir={onCoeurs}
            />
          )}
        </div>

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
            {fiche.revendication.pourCompagnie && (
              <span className={styles.depuis}>
                · pour{' '}
                <Link
                  className={styles.pourCompagnie}
                  to={`../../compagnie/${fiche.revendication.pourCompagnie.id}`}
                  relative="path"
                >
                  {fiche.revendication.pourCompagnie.nom}
                </Link>
              </span>
            )}
          </p>
        )}

        <div className={styles.visite}>{boutonVisite(fiche)}</div>

        {fiche.recit && (
          <section className={styles.recit} aria-label="Le récit">
            <h3 className={styles.rubrique}>Le récit</h3>
            <p className={styles.texte}>{fiche.recit}</p>
          </section>
        )}

        <InfosEnPlus rubriques={fiche.rubriques} bivouac={fiche.bivouacTolere} />

        <div className={styles.enrichir}>
          <Button kind="secondaire" onClick={onEnrichir}>
            Enrichir la fiche
          </Button>
        </div>

        <footer className={styles.credits}>
          {fiche.auteur && (
            // Ajouté sur place : le nom en or et les étoiles ; à distance, un crédit plus discret
            // (Uriel, 30/09 : « moins fort qu'un ajout en physique »).
            <p className={styles.credit} data-distance={fiche.ajoutADistance || undefined}>
              <Avatar url={fiche.auteur.avatar} nom={fiche.auteur.nom} taille="mini" />
              <span>
                {fiche.ajoutADistance ? 'Lieu ajouté à distance par ' : 'Lieu ajouté par '}
                <strong className={styles.nomCredit}>{fiche.auteur.nom}</strong>
                {fiche.ajoutADistance ? (
                  ' '
                ) : (
                  <img className={styles.etoiles} src={etoiles} alt="" />
                )}
                <span className={styles.date}>le {LE.format(new Date(fiche.ajouteLe))}</span>
              </span>
            </p>
          )}
          {enrichi.length > 0 && (
            <p className={styles.credit} data-distance={fiche.ajoutADistance || undefined}>
              <span className={styles.portraits}>
                {enrichi.slice(0, 3).map((p) => (
                  <Avatar key={p.id} url={p.avatar} nom={p.nom} taille="mini" />
                ))}
              </span>
              <span>
                Récit enrichi par{' '}
                {enrichi.map((p, i) => (
                  <Fragment key={p.id}>
                    {liaison(i, enrichi.length)}
                    <strong className={styles.nomEnrichi}>{p.nom}</strong>
                  </Fragment>
                ))}
              </span>
            </p>
          )}
          {coeurs && moi && (
            <CoeursDesAuteurs
              coeurs={coeurs}
              peutAimer={peutAimer}
              onAimer={aimer}
              onVoir={onCoeurs}
              auteurs={[
                ...new Set(
                  [fiche.auteur?.nom, ...fiche.recitPar.map((p) => p.nom)].filter(
                    (n) => n !== undefined,
                  ),
                ),
              ]}
            />
          )}
        </footer>

        <Carnet id={id} limite={3} />
      </div>
    </article>
  )
}

const RUBRIQUES = [
  { cle: 'acces', titre: 'Accès', icone: acces },
  { cle: 'quand', titre: 'Quand y aller', icone: quand },
  { cle: 'bonASavoir', titre: 'Bon à savoir', icone: bonASavoir },
] as const

// Les infos en plus : plus discrètes que le récit (Uriel, 05/10) ; une rubrique vide ne s'affiche pas.
function InfosEnPlus({ rubriques, bivouac }: { rubriques: Fiche['rubriques']; bivouac: boolean }) {
  const remplies = RUBRIQUES.filter((r) => rubriques[r.cle] !== null)
  if (remplies.length === 0 && !bivouac) return null
  return (
    <section className={styles.infos} aria-label="Infos en plus">
      {remplies.map((r) => (
        <div key={r.cle} className={styles.info}>
          <img className={styles.iconeInfo} src={r.icone} alt="" />
          <div>
            <h4 className={styles.titreInfo}>{r.titre}</h4>
            <p className={styles.texteInfo}>{rubriques[r.cle]}</p>
          </div>
        </div>
      ))}
      {bivouac && (
        <p className={styles.info}>
          <img className={styles.iconeInfo} src={bivouacIcone} alt="" />
          <span className={styles.titreInfo}>Bivouac toléré</span>
        </p>
      )}
    </section>
  )
}
