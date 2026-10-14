/**
 * QUOI     — la contribution qu'on lit : le client, le produit et la note, le message, la note de l'équipe,
 *            les photos, les étiquettes, puis les décisions.
 * POURQUOI — une seule lecture pour tout ce qui touche à la contribution ; chaque bloc écrit par ses
 *            propres boutons et affiche sa propre erreur. Les photos passent par PhotoDeContribution,
 *            les décisions par DecisionsDeContribution : c'est là que se branchent les canaux, le
 *            téléchargement et la suppression.
 */
import { dateCourte } from '@/shared/lib/dates'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import type { Contribution } from '../api/contributions'
import { useEcritureContribution } from '../hooks/useContributions'
import { STATUTS } from '../lib/contribution'
import { DecisionsDeContribution } from './DecisionsDeContribution'
import { EtiquettesDeContribution } from './EtiquettesDeContribution'
import { MessageDeContribution } from './MessageDeContribution'
import { PhotoDeContribution } from './PhotoDeContribution'
import boutique from './Boutique.module.css'
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
  const coordonnees = [c.email, c.instagram, [c.lieu, c.code_postal].filter(Boolean).join(' '), c.departement, dateCourte(c.quand)].filter(Boolean)
  const mesures = [c.hauteur !== null && `Hauteur : ${String(c.hauteur)} cm`, c.epaules !== null && `Épaules : ${String(c.epaules)} cm`].filter(Boolean)

  return (
    <Bloc className={styles.lecture ?? ''}>
      <div className={styles.client}>
        <h2 className={styles.nomDuClient}>{c.nom}</h2>
        {c.role && <Balise texte={ROLES[c.role] ?? c.role} teinte="compte" />}
        <Balise texte={STATUTS[c.statut]} teinte="moderation" />
        {c.diffusion && <Balise texte="Diffusion OK" teinte="nouveau" />}
      </div>
      <p className={boutique.calme}>{coordonnees.join(' · ')}</p>

      {(c.produit || c.note_experience !== null || c.note_produits !== null || mesures.length > 0) && (
        <div className={styles.produit}>
          {c.produit && <p>{`Porte : ${c.produit}${c.taille ? ` · taille ${c.taille}` : ''}`}</p>}
          {(c.note_experience !== null || c.note_produits !== null) && (
            <p><Etoiles libelle="Expérience" note={c.note_experience} /> · <Etoiles libelle="Produits" note={c.note_produits} /></p>
          )}
          {mesures.length > 0 && <p>{mesures.join(' · ')}</p>}
        </div>
      )}

      <MessageDeContribution id={c.id} message={c.message} ecriture={ecriture.message} />
      {c.note_equipe && <p className={styles.noteEquipe}>{c.note_equipe} <span>Privée, jamais publiée</span></p>}

      <div className={styles.photos}>
        {c.images.map((photo, rang) => <PhotoDeContribution key={photo.id} contribution={c} photo={photo} rang={rang} />)}
      </div>

      <EtiquettesDeContribution contribution={c} ecriture={ecriture} />
      <DecisionsDeContribution contribution={c} ecriture={ecriture.moderer} onDecide={onDecide} />
    </Bloc>
  )
}
