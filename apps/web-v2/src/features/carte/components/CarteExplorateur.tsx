/**
 * QUOI     — la carte d'un Explorateur touché sur la carte (maquette « Carte — un Explorateur
 *            touché », carte 366:236) : centrée comme le profil, son signe en grand filigrane
 *            derrière le portrait, sur le fond parchemin ; son nom, son titre, son niveau, « en
 *            ligne · à 12 km de toi » ; « Voir le profil » et « Envoyer un murmure ».
 * POURQUOI — Uriel, 01/10 : la même couverture que le profil — on reconnaît la personne du premier
 *            coup d'œil. Sans signe, le parchemin seul. Partir (profil, murmure) la referme :
 *            sinon elle resterait par-dessus l'écran suivant (la carte reste montée).
 */
import { useNavigate } from 'react-router'
import type { Point } from '@/shared/lib/distance'
import { sousLeSigne } from '@/shared/lib/signe'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import type { Actif } from '../api/lireActifs'
import { distanceDe, etat } from '../lib/actifs'
import styles from './CarteExplorateur.module.css'

function ouEtQuand(a: Actif, moi: Point | null): string {
  const distance = distanceDe(a, moi)
  return distance ? `${etat(a)} · à ${distance} de toi` : etat(a)
}

export function CarteExplorateur({
  actif: a,
  moi,
  onFermer,
}: {
  actif: Actif
  moi: Point | null
  onFermer: () => void
}) {
  const navigate = useNavigate()
  const signe = a.signe && sousLeSigne(a.signe.nom)
  const niveau = a.titre ? `${a.titre} · niveau ${String(a.niveau)}` : `Niveau ${String(a.niveau)}`

  return (
    <Feuille titre={a.nom} onFermer={onFermer}>
      <div className={styles.carte}>
        {a.signe?.imageUrl && <img className={styles.filigrane} src={a.signe.imageUrl} alt="" />}
        <Avatar url={a.avatar} nom={a.nom} taille="grand" />
        <h2 className={styles.nom}>{a.nom}</h2>
        <p className={styles.niveau}>{niveau}</p>
        {signe && (
          <p className={styles.signe}>
            {signe.avant}
            {signe.nom}
          </p>
        )}
        <p className={styles.etat} data-recent={!a.enLigne || undefined}>
          {ouEtQuand(a, moi)}
        </p>
        <div className={styles.actions}>
          <Button
            kind="secondaire"
            onClick={() => {
              onFermer()
              void navigate(`/carte/explorateur/${a.id}`)
            }}
          >
            Voir le profil
          </Button>
          <Button
            onClick={() => {
              onFermer()
              void navigate(`/messages/murmures/${a.id}`)
            }}
          >
            Envoyer un murmure
          </Button>
        </div>
      </div>
    </Feuille>
  )
}
