/**
 * QUOI     — la fiche d'une Compagnie (maquettes 389:309 et 454:272) : le bandeau à sa couleur,
 *            l'avatar, le nom, la devise, la mission ; le bouton selon ma place ; qui la mène (le Chef
 *            et les Officiers, rôles accordés) ; les membres, chacun avec son niveau et son titre, les
 *            huit derniers venus puis « Voir les autres » ; « Leurs lieux » en cartes photo, comme
 *            sur le profil, « Revendiqué par … » sous chacune (migration 438, maquette 461:362) ;
 *            « Gérer » pour le Chef
 *            et les Officiers ; « Quitter » pour un membre.
 * POURQUOI — une Compagnie est une antenne locale qu'on rejoint d'un geste (publique) ou sur demande
 *            (privée) ; son canal vit dans La Communauté (« Ouvrir le canal » y coche sa gélule).
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { useGlisser } from '@/shared/hooks/useGlisser'
import { useMaPosition } from '@/shared/hooks/useMaPosition'
import drapeau from '@/assets/ui/drapeau.svg'
import { teinteCompagnie } from '@/shared/lib/teinte'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Feuille } from '@/shared/ui/Feuille'
import { LieuCarte } from '@/shared/ui/LieuCarte'
import type { FicheCompagnie as Fiche } from '../api/lireCompagnies'
import { useCompagnie } from '../hooks/useCompagnie'
import { messageDeRefus } from '../lib/refus'
import { nomDuRole } from '../lib/roles'
import { AvatarCompagnie } from './AvatarCompagnie'
import styles from './FicheCompagnie.module.css'

const LE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const LE_JOUR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })
const VISIBLES = 8 // membres montrés avant « Voir les autres »

export function FicheCompagnie({ id }: { id: string }) {
  const { fiche, erreur, rejoindre, quitter, enCours, refus } = useCompagnie(id)
  const [quitterOuvert, setQuitterOuvert] = useState(false)
  const [tousLesMembres, setTousLesMembres] = useState(false)
  const position = useMaPosition()
  const glisser = useGlisser()
  if (erreur) return <EmptyState>La Compagnie n’a pas pu être chargée</EmptyState>
  if (fiche === undefined) return <div className={styles.chargement} aria-busy="true" />
  if (fiche === null) return <EmptyState>Cette Compagnie n’existe plus.</EmptyState>

  const meneurs = fiche.membres.filter((m) => m.role !== 'membre')
  const autres = fiche.membres.filter((m) => m.role === 'membre')
  const gere = fiche.monRole === 'chef' || fiche.monRole === 'officier'

  return (
    <article className={styles.fiche} style={teinteCompagnie(fiche.couleur)}>
      <div className={styles.bandeau} />
      <div className={styles.corps}>
        <AvatarCompagnie
          nom={fiche.nom}
          avatar={fiche.avatar}
          couleur={fiche.couleur}
          taille={88}
        />
        <h2 className={styles.nom}>{fiche.nom}</h2>
        {fiche.devise && <p className={styles.devise}>{fiche.devise}</p>}
        <p className={styles.infos}>
          {fiche.privee ? 'Compagnie privée' : 'Compagnie publique'} · fondée le{' '}
          {LE.format(new Date(fiche.fondeeLe))} · {fiche.nbMembres} membre
          {fiche.nbMembres > 1 ? 's' : ''}
        </p>
        {fiche.mission && <p className={styles.mission}>{fiche.mission}</p>}

        <BoutonDeLaFiche fiche={fiche} enCours={enCours} onRejoindre={rejoindre} />
        {refus !== null && (
          <p className={styles.refus} role="alert">
            {messageDeRefus(refus)}
          </p>
        )}

        {meneurs.length > 0 && (
          <section aria-labelledby="meneurs">
            <h3 id="meneurs" className={styles.section}>
              Qui la mène
            </h3>
            <ul className={styles.liste}>
              {meneurs.map((m) => (
                <li key={m.id}>
                  <Link
                    className={styles.personne}
                    to={`../../explorateur/${m.id}`}
                    relative="path"
                  >
                    <Avatar url={m.avatar} nom={m.nom} taille="petit" />
                    <span>
                      <span className={styles.qui}>{m.nom}</span>
                      <span className={styles.role}>{nomDuRole(fiche.roles, m.role, m.genre)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {autres.length > 0 && (
          <section aria-labelledby="membres">
            <h3 id="membres" className={styles.section}>
              Les membres · {autres.length}
            </h3>
            <ul className={styles.liste}>
              {(tousLesMembres ? autres : autres.slice(0, VISIBLES)).map((m) => (
                <li key={m.id} className={styles.membre}>
                  <Link
                    className={styles.personne}
                    to={`../../explorateur/${m.id}`}
                    relative="path"
                  >
                    <Avatar url={m.avatar} nom={m.nom} taille="petit" />
                    <span>
                      <span className={styles.qui}>{m.nom}</span>
                      <span className={styles.niveau}>
                        Niveau {m.niveau}
                        {m.titre && (
                          <>
                            {' · '}
                            <span className={styles.titre}>{m.titre}</span>
                          </>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {!tousLesMembres && autres.length > VISIBLES && (
              <button
                type="button"
                className={styles.voirTous}
                onClick={() => {
                  setTousLesMembres(true)
                }}
              >
                Voir les {autres.length - VISIBLES} autres ⌄
              </button>
            )}
          </section>
        )}

        {fiche.lieux.length > 0 && (
          <section aria-labelledby="lieux">
            <h3 id="lieux" className={styles.section}>
              Leurs lieux · {fiche.lieux.length}
            </h3>
            <p className={styles.sousSection}>Revendiqués pour la Compagnie</p>
            {/* Carrousel : cadre flex > rangée flex: 1 qui défile (règle de interface.md). */}
            <div className={styles.cadre}>
              <ul ref={glisser} className={styles.rangee}>
                {fiche.lieux.map((l) => (
                  <LieuCarte
                    key={l.id}
                    lieu={l}
                    position={position}
                    avecAuteur={false}
                    legende={
                      // « par … » sur la carte laissait croire à l'auteur du lieu (Uriel, 07/10).
                      <>
                        <img className={styles.drapeau} src={drapeau} alt="" />
                        <span className={styles.revendique}>
                          Revendiqué
                          {l.auteur && (
                            <>
                              {' par '}
                              <strong>{l.auteur.nom}</strong>
                            </>
                          )}
                          {' · '}
                          {LE_JOUR.format(new Date(l.quand))}
                        </span>
                      </>
                    }
                  />
                ))}
              </ul>
            </div>
          </section>
        )}

        {gere && (
          <Link className={styles.gerer} to="gerer" relative="path">
            Gérer la Compagnie ›
          </Link>
        )}
        {fiche.monRole !== null && (
          <button
            type="button"
            className={styles.quitter}
            onClick={() => {
              setQuitterOuvert(true)
            }}
          >
            Quitter la Compagnie
          </button>
        )}
      </div>

      {quitterOuvert && (
        <Feuille
          titre={`Quitter ${fiche.nom} ?`}
          onFermer={() => {
            setQuitterOuvert(false)
          }}
        >
          <p className={styles.mission}>
            Tu ne verras plus son canal.
            {fiche.monRole === 'chef' &&
              ' La main passera à un officier, ou au plus ancien membre.'}
          </p>
          <Button
            onClick={() => {
              quitter()
              setQuitterOuvert(false)
            }}
          >
            Quitter
          </Button>
        </Feuille>
      )}
    </article>
  )
}

// Rejoindre (publique), Demander (privée), la demande qui attend, ou le canal pour un membre.
function BoutonDeLaFiche({
  fiche,
  enCours,
  onRejoindre,
}: {
  fiche: Fiche
  enCours: boolean
  onRejoindre: () => void
}) {
  if (fiche.monRole !== null) {
    return (
      <Link className={styles.canal} to={`/messages?canal=${fiche.id}`}>
        Ouvrir le canal
      </Link>
    )
  }
  if (fiche.demandee) {
    return (
      <Button kind="secondaire" disabled>
        Demande envoyée
      </Button>
    )
  }
  return (
    <Button disabled={enCours} onClick={onRejoindre}>
      {fiche.privee ? 'Demander à rejoindre' : 'Rejoindre la Compagnie'}
    </Button>
  )
}
