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
import { Bloc } from '@/shared/ui/Bloc'
import type { Contribution } from '../api/contributions'
import { useEcritureContribution } from '../hooks/useContributions'
import { DecisionsDeContribution } from './DecisionsDeContribution'
import { EtiquettesDeContribution } from './EtiquettesDeContribution'
import { MessageDeContribution } from './MessageDeContribution'
import { PhotoDeContribution } from './PhotoDeContribution'
import styles from './Photos.module.css'

const ROLES: Record<string, string> = { client: 'Client', ambassadeur: 'Ambassadeur', partenaire: 'Partenaire' }

function Etoiles({ libelle, note }: { libelle: string; note: number | null }) {
  if (note === null) return null
  const pleines = Math.min(5, Math.max(0, Math.round(note)))
  return (
    <span aria-label={`${libelle} : ${String(pleines)} sur 5`}>
      {libelle} <span aria-hidden="true">{'★'.repeat(pleines)}{'☆'.repeat(5 - pleines)}</span>
    </span>
  )
}

export function LectureContribution({ contribution, onDecide }: { contribution: Contribution; onDecide: () => void }) {
  const ecriture = useEcritureContribution()
  const c = contribution
  const ou = [c.lieu, c.code_postal].filter(Boolean).join(' ')
  const infos = [
    c.role && (ROLES[c.role] ?? c.role), c.email, c.instagram, ou, c.departement,
    c.quand && `reçue le ${dateCourte(c.quand)}`, c.compte && 'aussi Explorateur',
  ].filter(Boolean)
  const mesures = [c.hauteur !== null && `Hauteur : ${String(c.hauteur)} cm`, c.epaules !== null && `Épaules : ${String(c.epaules)} cm`].filter(Boolean)
  const notee = c.note_experience !== null || c.note_produits !== null

  return (
    <Bloc className={styles.lecture ?? ''}>
      <header className={styles.tete}>
        <span className={styles.portrait} aria-hidden="true">{c.nom.slice(0, 1).toUpperCase()}</span>
        <div className={styles.qui}>
          <h2 className={styles.nomDuClient}>{c.nom}</h2>
          <p className={styles.infos}>{infos.join(' · ')}</p>
        </div>
        {c.produit && <span className={styles.produitPorte}>{`${c.produit}${c.taille ? ` · ${c.taille}` : ''}`}</span>}
      </header>

      {(notee || mesures.length > 0) && (
        <div className={styles.avis}>
          {notee && (
            <p className={styles.etoiles}>
              <Etoiles libelle="Produits" note={c.note_produits} />
              {c.note_produits !== null && c.note_experience !== null && ' · '}
              <Etoiles libelle="Expérience" note={c.note_experience} />
            </p>
          )}
          {mesures.length > 0 && <p className={styles.mesures}>{mesures.join(' · ')}</p>}
        </div>
      )}

      <MessageDeContribution id={c.id} message={c.message} ecriture={ecriture.message} />
      {c.note_equipe && <p className={styles.noteEquipe}>{c.note_equipe} <span>Privée, jamais publiée</span></p>}

      <div className={styles.photos}>
        {c.images.map((photo, rang) => <PhotoDeContribution key={photo.id} contribution={c} photo={photo} rang={rang} />)}
      </div>

      <EtiquettesDeContribution contribution={c} ecriture={ecriture} />
      <DecisionsDeContribution contribution={c} ecriture={ecriture.moderer} suppression={ecriture.supprimer} onDecide={onDecide} />
    </Bloc>
  )
}
