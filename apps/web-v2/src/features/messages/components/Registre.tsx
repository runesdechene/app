/**
 * QUOI     — le Registre (maquette 45:278, spec V2 §10) : les canaux à cocher, une colonne dense
 *            de messages (le portrait, le nom, le texte, l'heure à droite), et la barre pour écrire.
 * POURQUOI — « un chat de MMO, pas une messagerie » : pas de fils, pas de citations. Un
 *            message de « Bugs & suggestions » porte son préfixe, même seul canal coché : chaque
 *            message dit d'où il vient (Uriel, 28/09) — une fois par groupe d'un même auteur, pas
 *            à chaque ligne (29/09). L'heure à droite : on lit d'abord
 *            qui parle. Un nom ouvre le profil, dans Messages, qui reste derrière. On mentionne avec
 *            « @ » (migration 373) : la mention s'affiche en lien, et un message qui me mentionne
 *            est doucement surligné. Un séparateur marque chaque nouveau jour (« Hier », « Samedi 26
 *            septembre ») : minuit coupe aussi un groupe. Entre les messages du canal général, les
 *            arrivées (migrations 408, 411) : qui a rejoint EXPLORE, d'affilée en une ligne. Chaque message se dessine par
 *            `LigneMessage`, avec ses cœurs (migration 410).
 */
import { Fragment, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import coche from '@/assets/ui/coche-canal.svg'
import { CANAUX, type Canal } from '../api/lireRegistre'
import { useColleEnBas } from '../hooks/useColleEnBas'
import { useMentions } from '../hooks/useMentions'
import { useRegistre } from '../hooks/useRegistre'
import { entremeler } from '../lib/fil'
import { autreJour, jourDe } from '../lib/jour'
import { estLaSuite } from '../lib/suite'
import { BarreEcrire } from './BarreEcrire'
import { ChoixCanal } from './ChoixCanal'
import { LigneMessage } from './LigneMessage'
import { LignePassage } from './LignePassage'
import { ListeMentions } from './ListeMentions'
import styles from './Registre.module.css'

const NOMS: Record<Canal, { filtre: string; court: string }> = {
  general: { filtre: 'Canal général', court: 'Général' },
  bugs: { filtre: 'Bugs & suggestions', court: 'Bugs & suggestions' },
}

export function Registre() {
  const { messages, passages, erreur, ecrire, aimer, aimeEnCours, echecEnvoi } = useRegistre()
  const [coches, setCoches] = useState<Set<Canal>>(() => new Set(CANAUX))
  const [canal, setCanal] = useState<Canal>('general')
  // Le dernier message reste en vue ; seule la liste défile, le haut et la barre restent fixes.
  const coller = useColleEnBas()
  const champ = useRef<HTMLInputElement>(null)
  const [texte, setTexte] = useState('')
  const [curseur, setCurseur] = useState(0)
  const mentions = useMentions(texte, curseur)
  const placer = (apres: { texte: string; curseur: number }) => {
    // Le texte s'écrit tout de suite, puis le curseur se pose après « @Nom » : une lettre tapée
    // aussitôt ne le voit jamais revenir en arrière.
    flushSync(() => {
      setTexte(apres.texte)
      setCurseur(apres.curseur)
    })
    champ.current?.setSelectionRange(apres.curseur, apres.curseur)
  }

  // Les arrivées ne vivent que dans le canal général.
  const fil = entremeler(
    (messages ?? []).filter((m) => coches.has(m.canal)),
    coches.has('general') ? passages : [],
  )

  const basculer = (c: Canal) => {
    setCoches((avant) => {
      const apres = new Set(avant)
      if (apres.has(c)) apres.delete(c)
      else apres.add(c)
      return apres.size === 0 ? avant : apres // au moins un canal reste coché
    })
  }

  return (
    <div className={styles.registre}>
      <div className={styles.filtres} role="group" aria-label="Canaux">
        {CANAUX.map((c) => (
          <button
            key={c}
            type="button"
            className={c === 'bugs' ? styles.filtreBugs : styles.filtre}
            aria-pressed={coches.has(c)}
            onClick={() => {
              basculer(c)
            }}
          >
            {coches.has(c) && <img src={coche} alt="" width={10} height={10} />}
            {NOMS[c].filtre}
          </button>
        ))}
      </div>

      {erreur && <p className={styles.alerte}>Le Registre n’a pas pu être lu.</p>}
      <ol ref={coller} className={styles.messages} aria-label="Registre">
        {fil.map((ligne, i) => {
          const nouveauJour = autreJour(fil[i - 1]?.quand, ligne.quand)
          const jour = nouveauJour && (
            <li role="separator" aria-label={jourDe(ligne.quand)} className={styles.jour}>
              {jourDe(ligne.quand)}
            </li>
          )
          if (ligne.sorte === 'arrivees') {
            return (
              <Fragment key={ligne.passages[0]?.id ?? ligne.quand}>
                {jour}
                <LignePassage passages={ligne.passages} />
              </Fragment>
            )
          }
          const m = ligne.message
          const avant = fil[i - 1]
          const precedent = avant?.sorte === 'message' ? avant.message : undefined
          // La suite d'un même auteur : ni portrait ni nom, juste le texte et l'heure, serrés.
          const suite = !nouveauJour && estLaSuite(precedent, m)
          // Dans un groupe, le préfixe du canal ne se répète pas : il revient si le canal change.
          const prefixe = m.canal === 'bugs' && !(suite && precedent?.canal === 'bugs')
          return (
            <Fragment key={m.id}>
              {jour}
              <LigneMessage
                message={m}
                suite={suite}
                prefixe={prefixe}
                aimeEnCours={aimeEnCours?.id === m.id ? aimeEnCours.aime : undefined}
                onAimer={aimer}
              />
            </Fragment>
          )
        })}
      </ol>

      <BarreEcrire
        invite="Écrire quelque chose"
        maximum={500}
        onEnvoyer={(t) =>
          ecrire(canal, t, mentions.mentionsDe(t)).then(() => {
            mentions.oublier()
          })
        }
        saisie={{
          texte,
          champ,
          changer: (t, c) => {
            setTexte(t)
            setCurseur(c)
          },
          clavier: (e) => {
            const choisie = mentions.clavier(e)
            if (choisie) placer(mentions.choisir(choisie))
          },
        }}
        dessus={
          mentions.suggestions.length > 0 && (
            <ListeMentions
              personnes={mentions.suggestions}
              actif={mentions.actif}
              onChoisir={(p) => {
                placer(mentions.choisir(p))
              }}
            />
          )
        }
        avant={
          <ChoixCanal
            canaux={CANAUX}
            noms={{ general: NOMS.general.court, bugs: NOMS.bugs.court }}
            valeur={canal}
            onChange={setCanal}
          />
        }
      />
      {echecEnvoi && (
        <p role="alert" className={styles.alerte}>
          Le message n’est pas parti. Réessaie dans un instant.
        </p>
      )}
    </div>
  )
}
