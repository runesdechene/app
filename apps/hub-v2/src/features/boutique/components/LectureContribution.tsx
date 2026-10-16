/**
 * QUOI     — la contribution qu'on lit (maquette « Photos et avis : la file », Figma 596:1319) : la tête
 *            (portrait, nom, ce qu'on sait du client, le produit porté), les étoiles et le message, la
 *            note de l'équipe, les photos et leurs canaux, les étiquettes, puis les décisions.
 * POURQUOI — une seule lecture pour tout ce qui touche à la contribution ; chaque bloc écrit par ses
 *            propres boutons et affiche sa propre erreur. Les photos passent par PhotoDeContribution,
 *            les décisions par DecisionsDeContribution : c'est là que se branchent les canaux, le
 *            téléchargement et la suppression.
 */
import { dateCourte } from '@/shared/lib/dates'
import type { Contribution } from '../api/contributions'
import { useEcritureContribution } from '../hooks/useContributions'
import { estUneVideo } from '../lib/contribution'
import { DecisionsDeContribution } from './DecisionsDeContribution'
import { EtiquettesDeContribution } from './EtiquettesDeContribution'
import { MessageDeContribution } from './MessageDeContribution'
import { PhotoDeContribution } from './PhotoDeContribution'
import styles from './Photos.module.css'

const ROLES: Record<string, string> = { client: 'Client', ambassadeur: 'Ambassadeur', partenaire: 'Partenaire' }

/** Une seule ligne d'étoiles, comme la maquette : la note des produits, sinon celle de l'expérience. */
function Etoiles({ produits, experience }: { produits: number | null; experience: number | null }) {
  const note = produits ?? experience
  if (note === null) return null
  const pleines = Math.min(5, Math.max(0, Math.round(note)))
  const libelle = [produits !== null && `Produits : ${String(Math.round(produits))} sur 5`, experience !== null && `Expérience : ${String(Math.round(experience))} sur 5`].filter(Boolean).join(' · ')
  return <p className={styles.etoiles} title={libelle} aria-label={libelle}>{'★'.repeat(pleines)}{'☆'.repeat(5 - pleines)}</p>
}

export function LectureContribution({ contribution, onDecide }: { contribution: Contribution; onDecide: () => void }) {
  const ecriture = useEcritureContribution()
  const c = contribution
  const ou = [c.lieu, c.code_postal].filter(Boolean).join(' ')
  const infos = [
    c.role && (ROLES[c.role] ?? c.role), c.email, c.instagram, ou, c.departement,
    c.hauteur !== null && `${String(c.hauteur)} cm`, c.epaules !== null && `épaules ${String(c.epaules)} cm`,
    c.quand && `reçue le ${dateCourte(c.quand)}`, c.compte && 'aussi Explorateur',
  ].filter(Boolean)
  const portrait = c.images.find((i) => !estUneVideo(i.url))?.url

  return (
    <section className={styles.lecture} aria-label={`La contribution de ${c.nom}`}>
      <header className={styles.tete}>
        {portrait
          ? <img className={styles.portrait} src={portrait} alt="" />
          : <span className={styles.portrait} aria-hidden="true">{c.nom.slice(0, 1).toUpperCase()}</span>}
        <div className={styles.qui}>
          <h2 className={styles.nomDuClient}>{c.nom}</h2>
          <p className={styles.infos}>{infos.join(' · ')}</p>
        </div>
        {c.produit && <span className={styles.produitPorte}>{`${c.produit}${c.taille ? ` · ${c.taille}` : ''}`}</span>}
      </header>

      <div className={styles.avis}>
        <Etoiles produits={c.note_produits} experience={c.note_experience} />
        <MessageDeContribution id={c.id} message={c.message} ecriture={ecriture.message} />
        {c.note_equipe && <p className={styles.noteEquipe}>{c.note_equipe} <span>Privée, jamais publiée</span></p>}
      </div>

      <div className={styles.photos}>
        {c.images.map((photo, rang) => <PhotoDeContribution key={photo.id} contribution={c} photo={photo} rang={rang} />)}
      </div>

      <EtiquettesDeContribution contribution={c} ecriture={ecriture} />
      <DecisionsDeContribution contribution={c} ecriture={ecriture.moderer} suppression={ecriture.supprimer} onDecide={onDecide} />
    </section>
  )
}
