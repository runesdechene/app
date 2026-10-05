/**
 * QUOI     — la fiche d'une Compagnie (maquette 389:309) : le bandeau à sa couleur, l'avatar, le nom,
 *            la devise, la mission ; le bouton selon ma place ; qui la mène (le Chef et les
 *            Officiers, rôles accordés) ; les membres ; « Leurs lieux » ; « Gérer » pour le Chef et
 *            les Officiers ; « Quitter » pour un membre.
 * POURQUOI — une Compagnie est une antenne locale qu'on rejoint d'un geste (publique) ou sur demande
 *            (privée) ; son canal vit dans La Communauté (« Ouvrir le canal » y coche sa gélule).
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Feuille } from '@/shared/ui/Feuille'
import type { FicheCompagnie as Fiche } from '../api/lireCompagnies'
import { useCompagnie } from '../hooks/useCompagnie'
import { nomDuRole } from '../lib/roles'
import { AvatarCompagnie } from './AvatarCompagnie'
import styles from './FicheCompagnie.module.css'

const LE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const PORTRAITS = 6

export function FicheCompagnie({ id }: { id: string }) {
  const { fiche, erreur, rejoindre, quitter, enCours } = useCompagnie(id)
  const [quitterOuvert, setQuitterOuvert] = useState(false)
  if (erreur) return <EmptyState>La Compagnie n’a pas pu être chargée</EmptyState>
  if (fiche === undefined) return <div className={styles.chargement} aria-busy="true" />
  if (fiche === null) return <EmptyState>Cette Compagnie n’existe plus.</EmptyState>

  const meneurs = fiche.membres.filter((m) => m.role !== 'membre')
  const autres = fiche.membres.filter((m) => m.role === 'membre')
  const gere = fiche.monRole === 'chef' || fiche.monRole === 'officier'

  return (
    <article className={styles.fiche} style={{ '--couleur': fiche.couleur }}>
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
          {LE.format(new Date(fiche.fondeeLe))} · {fiche.membres.length} membre
          {fiche.membres.length > 1 ? 's' : ''}
        </p>
        {fiche.mission && <p className={styles.mission}>{fiche.mission}</p>}

        <BoutonDeLaFiche fiche={fiche} enCours={enCours} onRejoindre={rejoindre} />

        {meneurs.length > 0 && (
          <section aria-labelledby="meneurs">
            <h3 id="meneurs" className={styles.section}>
              Qui la mène
            </h3>
            <ul className={styles.meneurs}>
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
              Les membres
            </h3>
            <p className={styles.membres}>
              <span className={styles.portraits}>
                {autres.slice(0, PORTRAITS).map((m) => (
                  <Avatar key={m.id} url={m.avatar} nom={m.nom} taille="mini" />
                ))}
              </span>
              {autres
                .slice(0, 3)
                .map((m) => m.nom)
                .join(', ')}
              {autres.length > 3 && ` et ${String(autres.length - 3)} autres`}
            </p>
          </section>
        )}

        {fiche.lieux.length > 0 && (
          <section aria-labelledby="lieux">
            <h3 id="lieux" className={styles.section}>
              Leurs lieux
            </h3>
            <p className={styles.sousSection}>Revendiqués pour la Compagnie</p>
            <ul className={styles.lieux}>
              {fiche.lieux.map((l) => (
                <li key={l.id}>
                  <Link className={styles.lieu} to={`../../lieu/${l.id}`} relative="path">
                    <span className={styles.nomLieu}>{l.nom}</span>
                    <span className={styles.par}>
                      {l.par ? `par ${l.par} · ` : ''}
                      {LE.format(new Date(l.quand))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
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
