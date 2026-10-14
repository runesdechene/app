/**
 * QUOI     — « Les écoutes » : le tableau de bord de la voix off. Quatre tuiles, le verdict (garde-t-on la voix
 *            off ?), la couverture (CouvertureAudio) et une ligne par Fragment.
 * POURQUOI — la lecture des écoutes et celles de Shopify sont indépendantes : une panne de Shopify laisse les
 *            écoutes affichées, une panne des écoutes laisse la couverture. Tant qu'une lecture n'est pas
 *            arrivée, la tuile montre « … », jamais 0. Sous 20 écoutes réelles, le taux est « à confirmer ».
 */
import { dateCourte } from '@/shared/lib/dates'
import { depuis } from '@/shared/lib/quand'
import { pluriel } from '@/shared/lib/texte'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { Tuile } from '@/shared/ui/Tuile'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { EcouteDUnFragment } from '../api/ecoutes'
import { useEcoutes, useInventaireAudio } from '../hooks/useEcoutes'
import { resumeDesEcoutes, SEUIL_DECISION, type ResumeDesEcoutes } from '../lib/ecoutes'
import { CouvertureAudio } from './CouvertureAudio'
import styles from './Ecoutes.module.css'

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const pourcent = (n: number | null) => (n === null ? '—' : `${nombre.format(n)} %`)

function Verdict({ resume, fragments }: { resume: ResumeDesEcoutes; fragments: number }) {
  if (resume.ecoutes === 0) {
    return <p className={styles.verdict}>Le compteur démarre à la première écoute qui dépasse dix secondes.</p>
  }
  if (!resume.assez) {
    return (
      <p className={styles.verdict}>
        Pas encore de quoi trancher : {resume.ecoutes} {pluriel(resume.ecoutes, 'écoute')} {pluriel(resume.ecoutes, 'réelle')}.
        Il en faut une vingtaine avant que ce taux veuille dire quelque chose : un seul auditeur qui termine suffit à afficher 100 %.
      </p>
    )
  }
  return (
    <div className={styles.verdict}>
      <p>{pourcent(resume.taux)} des écoutes vont jusqu’au bout, sur {resume.ecoutes} écoutes réelles de {fragments} {pluriel(fragments, 'Fragment')}.</p>
      {resume.progression !== null && (
        <p>Ceux qui s’arrêtent en chemin parcourent {pourcent(resume.progression)} du récit en moyenne, sur {resume.mesurables} écoutes mesurées.</p>
      )}
    </div>
  )
}

function LigneDEcoute({ ligne, nom }: { ligne: EcouteDUnFragment; nom: string }) {
  const mesure = ligne.progression === null
    ? 'pas encore mesurée'
    : `${pourcent(ligne.progression)} du récit${ligne.mesurables < ligne.ecoutes ? ` · ${String(ligne.mesurables)}/${String(ligne.ecoutes)} mesurées` : ''}`
  return (
    <div className={styles.fragment}>
      <strong className={styles.fragmentNom}>{nom}</strong>
      <span className={styles.fragmentMesures}>
        <span>{ligne.ecoutes} écoutes · {ligne.completions} au bout</span>
        <span>{pourcent(ligne.taux)}{ligne.ecoutes < SEUIL_DECISION ? ' · à confirmer' : ''}</span>
        <span>{mesure}</span>
        <span>{ligne.ecoutes_motif} motif · {ligne.ecoutes_produit} produit</span>
        <span>{dateCourte(ligne.derniere_ecoute)}</span>
      </span>
    </div>
  )
}

export function Ecoutes() {
  const { data: stats, error, isPending } = useEcoutes()
  const { data: inventaire } = useInventaireAudio()
  const resume = stats && resumeDesEcoutes(stats)
  const nomDe = (handle: string) => inventaire?.illustrations.find((i) => i.handle === handle)?.nom ?? handle
  // Tant que la lecture n'est pas arrivée : « … », jamais 0 ; en panne : « — ».
  const valeur = (v: string | undefined) => v ?? (isPending ? '…' : '—')

  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Fragments et boutique"
        titre="Les écoutes"
        {...(resume ? { phrase: resume.derniere ? `Dernière écoute ${depuis(resume.derniere)}.` : 'Personne n’a encore écouté de Fragment.' } : {})}
      />
      {error && <p role="alert" className={styles.erreur}>Lecture des écoutes impossible : {error.message}</p>}
      <div className={styles.tuiles}>
        <Tuile libelle="Écoutes" valeur={valeur(resume && String(resume.ecoutes))} />
        <Tuile libelle="Vont au bout" valeur={valeur(resume && pourcent(resume.taux))} />
        <Tuile libelle="Récit parcouru" valeur={valeur(resume && pourcent(resume.progression))} />
        <Tuile libelle="Fragments écoutés" valeur={valeur(stats && String(stats.length))} />
      </div>
      {stats && resume && <Verdict resume={resume} fragments={stats.length} />}
      <CouvertureAudio />
      {stats && stats.length > 0 && (
        <section className={styles.section} aria-label="Par Fragment">
          <TitreDeSection titre="Par Fragment" />
          <Bloc>
            {stats.map((ligne) => <LigneDEcoute key={ligne.illustration_handle} ligne={ligne} nom={nomDe(ligne.illustration_handle)} />)}
          </Bloc>
        </section>
      )}
    </div>
  )
}
