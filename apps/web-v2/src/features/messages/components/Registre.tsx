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
 *            Chaque Compagnie dont je suis membre est un canal de plus (migration 422) : une gélule à
 *            sa couleur, ses messages à son encre, et « ＋ Compagnies » mène à la page des Compagnies.
 *            Les gélules tiennent sur une ligne qui défile, sans barre visible ; à la souris, on la
 *            tient et on la tire (Uriel, 05/10).
 *            `?canal=<id>` (« Ouvrir le canal » sur la fiche d'une Compagnie) coche et choisit ce canal.
 */
import { Fragment, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useSearchParams } from 'react-router'
import coche from '@/assets/ui/coche-canal.svg'
import { useGlisser } from '@/shared/hooks/useGlisser'
import { CANAUX_FIXES, type Canal, type Message } from '../api/lireRegistre'
import { useCanaux, type CanalCompagnie } from '../hooks/useCanaux'
import { useColleEnBas } from '../hooks/useColleEnBas'
import { useMentions } from '../hooks/useMentions'
import { useRegistre } from '../hooks/useRegistre'
import { entremeler } from '../lib/fil'
import { aideDuChamp } from '../lib/aide'
import { FILTRES_FIXES, garderFiltres, lireFiltres, type Filtre } from '../lib/filtres'
import { autreJour, jourDe } from '../lib/jour'
import { estLaSuite } from '../lib/suite'
import { BarreEcrire } from './BarreEcrire'
import { ChoixCanal } from './ChoixCanal'
import { LigneMessage } from './LigneMessage'
import { LignePassage } from './LignePassage'
import { ListeMentions } from './ListeMentions'
import styles from './Registre.module.css'

// Les gélules fixes ; « Activité » se lit, on n'y écrit pas.
const NOMS_DES_FILTRES: Record<(typeof FILTRES_FIXES)[number], string> = {
  general: 'Canal général',
  bugs: 'Bugs & suggestions',
  activite: 'Activité',
}
const PREFIXE_BUGS = '[Bug & Suggestions]'

// Le stockage de l'appareil, s'il est permis (il peut être refusé : navigation privée).
function stockage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const STYLES_DES_FILTRES: Record<(typeof FILTRES_FIXES)[number], string | undefined> = {
  general: styles.filtre,
  bugs: styles.filtreBugs,
  activite: styles.filtreActivite,
}

export function Registre() {
  const { compagnies, pret } = useCanaux()
  const [demande] = useSearchParams()
  // Le fil attend mes Compagnies (une lecture courte) ; les rejoindre ou les quitter le remonte :
  // ses gélules et son choix repartent du choix gardé, sans effet qui recolle l'état. Un nouveau
  // « ?canal= » le remonte aussi : l'onglet reste monté, « Ouvrir le canal » arrive sur un fil ouvert.
  if (!pret) return <div className={styles.registre} aria-busy="true" />
  const cle = `${compagnies.map((c) => c.id).join()}|${demande.get('canal') ?? ''}`
  return <Fil key={cle} compagnies={compagnies} />
}

function Fil({ compagnies }: { compagnies: CanalCompagnie[] }) {
  const ids = compagnies.map((c) => c.id)
  const connus = [...FILTRES_FIXES, ...ids]
  const { messages, passages, erreur, ecrire, aimer, aimeEnCours, echecEnvoi } = useRegistre([
    ...CANAUX_FIXES,
    ...ids,
  ])
  // « ?canal= » (« Ouvrir le canal » sur la fiche d'une Compagnie) : coché et choisi à l'arrivée.
  const [demande] = useSearchParams()
  const glisser = useGlisser()
  const voulu = ids.find((id) => id === demande.get('canal'))
  const [coches, setCoches] = useState<Set<Filtre>>(() => {
    const gardees = lireFiltres(stockage(), connus)
    if (voulu !== undefined) gardees.add(voulu)
    return gardees
  })
  const [canal, setCanal] = useState<Canal>(voulu ?? 'general')
  const compagnieDe = (c: Canal) => compagnies.find((x) => x.id === c)
  const nomDuCanal = (c: Canal) =>
    c === 'general' ? 'Général' : c === 'bugs' ? 'Bugs & suggestions' : (compagnieDe(c)?.nom ?? c)
  const ouverte = compagnieDe(canal)
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

  // Les arrivées vivent dans « Activité ».
  const fil = entremeler(
    (messages ?? []).filter((m) => coches.has(m.canal)),
    coches.has('activite') ? passages : [],
    messages?.[0]?.quand,
  )

  const basculer = (f: Filtre) => {
    const apres = new Set(coches)
    if (apres.has(f)) apres.delete(f)
    else apres.add(f)
    if (apres.size === 0) return // au moins une gélule reste cochée
    setCoches(apres)
    garderFiltres(stockage(), apres, connus)
  }

  return (
    <div className={styles.registre}>
      <div ref={glisser} className={styles.filtres} role="group" aria-label="Canaux">
        {FILTRES_FIXES.map((c) => (
          <button
            key={c}
            type="button"
            className={STYLES_DES_FILTRES[c]}
            aria-pressed={coches.has(c)}
            onClick={() => {
              basculer(c)
            }}
          >
            {coches.has(c) && <img src={coche} alt="" width={10} height={10} />}
            {NOMS_DES_FILTRES[c]}
          </button>
        ))}
        {compagnies.map((c) => (
          <button
            key={c.id}
            type="button"
            className={styles.filtreCompagnie}
            style={{ '--couleur': c.couleur }}
            aria-pressed={coches.has(c.id)}
            onClick={() => {
              basculer(c.id)
            }}
          >
            {coches.has(c.id) && <img src={coche} alt="" width={10} height={10} />}
            {c.nom}
          </button>
        ))}
        <Link className={styles.plusCompagnies} to="compagnies" relative="path">
          ＋ Compagnies
        </Link>
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
          const prefixe = suite && precedent?.canal === m.canal ? null : prefixeDe(m)
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
        invite={ouverte ? aideDuChamp(ouverte.nom) : 'Écrire quelque chose'}
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
            canaux={[...CANAUX_FIXES, ...ids]}
            nom={nomDuCanal}
            couleur={(c) => compagnieDe(c)?.couleur ?? null}
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

// Le préfixe d'un message : celui des bugs, ou le nom de sa Compagnie ; rien pour le général.
function prefixeDe(m: Message): string | null {
  if (m.canal === 'bugs') return PREFIXE_BUGS
  return m.canalNom === null ? null : `[${m.canalNom}]`
}
