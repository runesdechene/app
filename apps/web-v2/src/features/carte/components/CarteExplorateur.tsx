/**
 * QUOI     — la carte d'un Explorateur touché sur la carte (maquette « Carte — un Explorateur
 *            touché », carte 366:236) : centrée comme le profil, son signe en grand filigrane
 *            derrière le portrait, sur le fond parchemin ; son nom, son titre, son niveau, une ligne
 *            d'état ; « Voir le profil » et « Envoyer un murmure ».
 *            Deux portes : un Actif (« en ligne · à 12 km de toi »), ou qui tient un territoire
 *            (« Tient La Garde du Comté · 5 lieux » — Figma 878:2717), où ma propre carte propose
 *            « Renommer » au lieu du murmure.
 * POURQUOI — Uriel, 01/10 : la même couverture que le profil — on reconnaît la personne du premier
 *            coup d'œil. Sans signe, le parchemin seul. Partir (profil, murmure) la referme :
 *            sinon elle resterait par-dessus l'écran suivant (la carte reste montée).
 */
import { aLaTaille } from '@/shared/lib/image'
import { useNavigate } from 'react-router'
import type { Point } from '@/shared/lib/distance'
import { sousLeSigne } from '@/shared/lib/signe'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import type { Actif, Explorateur } from '../api/lireActifs'
import { distanceDe, etat } from '../lib/actifs'
import styles from './CarteExplorateur.module.css'

// La ligne sous l'identité : son ton dit « en ligne » (vert), « parti » (pâle) ou un territoire.
export type Etat = { texte: string; ton: 'enLigne' | 'recent' | 'mien' | 'autre' }

function ouEtQuand(a: Actif, moi: Point | null): Etat {
  const distance = distanceDe(a, moi)
  const texte = distance ? `${etat(a)} · à ${distance} de toi` : etat(a)
  return { texte, ton: a.enLigne ? 'enLigne' : 'recent' }
}

export function CarteExplorateur({
  actif,
  moi,
  onFermer,
}: {
  actif: Actif
  moi: Point | null
  onFermer: () => void
}) {
  return <CarteDExplorateur explorateur={actif} etat={ouEtQuand(actif, moi)} onFermer={onFermer} />
}

export function CarteDExplorateur({
  explorateur: a,
  etat: ligne,
  onFermer,
  onRenommer,
}: {
  explorateur: Explorateur
  etat: Etat
  onFermer: () => void
  onRenommer?: (() => void) | undefined
}) {
  const navigate = useNavigate()
  const signe = a.signe && sousLeSigne(a.signe.nom)
  const niveau = a.titre ? `${a.titre} · niveau ${String(a.niveau)}` : `Niveau ${String(a.niveau)}`

  return (
    <Feuille titre={a.nom} onFermer={onFermer}>
      <div className={styles.carte}>
        {a.signe?.imageUrl && (
          <img className={styles.filigrane} src={aLaTaille(a.signe.imageUrl, 300)} alt="" />
        )}
        <Avatar url={a.avatar} nom={a.nom} taille="grand" />
        <h2 className={styles.nom}>{a.nom}</h2>
        <p className={styles.niveau}>{niveau}</p>
        {signe && (
          <p className={styles.signe}>
            {signe.avant}
            {signe.nom}
          </p>
        )}
        <p className={styles.etat} data-ton={ligne.ton}>
          {ligne.texte}
        </p>
        <div className={styles.actions}>
          <Button
            kind="secondaire"
            onClick={() => {
              onFermer()
              void navigate(`/carte/explorateur/${a.id}`)
            }}
          >
            {onRenommer ? 'Voir mon profil' : 'Voir le profil'}
          </Button>
          {onRenommer ? (
            <Button onClick={onRenommer}>Renommer</Button>
          ) : (
            <Button
              onClick={() => {
                onFermer()
                void navigate(`/messages/murmures/${a.id}`)
              }}
            >
              Envoyer un murmure
            </Button>
          )}
        </div>
      </div>
    </Feuille>
  )
}
