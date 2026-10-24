/**
 * QUOI     — /qui-es-tu, « Dis-nous qui tu es » (maquette 776:2696) : l'accueil, sept questions une par
 *            une, puis « C'est noté » et le pin promis. Les réponses vont à la fonction `questionnaire`.
 * POURQUOI — sans compte : le lien signé de la Missive (?j=) dit qui répond, et ouvre l'accueil à son
 *            prénom. Un lien d'époque (?epoque=celtes) la coche, mais rien ne s'écrit avant « Envoyer mes
 *            réponses » : les messageries d'entreprise ouvrent seules les liens. La question est dans
 *            l'adresse (?q=3), comme l'étape de /soumettre-contenu : le retour du navigateur revient d'une
 *            question. Sans lien, la page demande l'e-mail et envoie le lien, rien d'autre.
 */
import { LIBRE_MAX, QUESTIONS, type Question, type Reponses } from '@runes/missives'
import { useEffect, useState, type ReactNode, type SubmitEvent } from 'react'
import { useSearchParams } from 'react-router'
import cadeau from '@/assets/flyer/cadeau.webp'
import shooting from '@/assets/questionnaire/shooting.webp'
import { LienBouton } from '../briques/Bouton'
import { CaseACocher } from '../briques/CaseACocher'
import { Champ } from '../briques/Champ'
import { MessageDErreur } from '../briques/MessageDErreur'
import { PagePublique } from '../PagePublique'
import { BoutonSombre } from '../soumettre/Etape'
import etape from '../soumettre/Etape.module.css'
import { DEPARTEMENTS } from '../soumettre/lib/departements'
import { Fenetre } from './Fenetre'
import { ETAPES } from './lib/etapes'
import styles from './PageQuestionnaire.module.css'

const FONCTION = '/.netlify/functions/questionnaire'
const BOUTIQUE = 'https://runesdechene.com'
const EXPLORE = 'https://app.runesdechene.com'
const DONNEES_PERSONNELLES = 'https://app.runesdechene.com/legal/confidentialite'
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const VIDE: Reponses = { epoques: [], epoque_autre: null, decouverte: [], decouverte_autre: null, amene: [], plait: [], attente: null, departement: null, anniv_jour: null, anniv_mois: null }
const A_CASES = Object.keys(QUESTIONS) as Question[]
const DERNIERE = ETAPES.length

type Lecture = { prenom: string | null; portrait: Reponses | null }

function Intitule({ n, titre, aide }: { n: number; titre: string; aide: string | null }) {
  return (
    <header className={styles.intitule}>
      <p className={styles.numero}>{n === DERNIERE ? 'Dernière question' : `Question ${String(n)}`}</p>
      <h2 className={styles.question}>{titre}</h2>
      {aide && <p className={styles.aide}>{aide}</p>}
    </header>
  )
}

/** Une question à cases : `max` atteint, les autres cases se figent. */
function Cases({ q, choisies, onChange }: { q: Question; choisies: string[]; onChange: (choisies: string[]) => void }) {
  const { titre, max, reponses } = QUESTIONS[q]
  const plein = max !== null && choisies.length >= max
  return (
    <div className={styles.reponses} role="group" aria-label={titre}>
      {reponses.map(([cle, libelle]) => {
        const cochee = choisies.includes(cle)
        return (
          <label key={cle} className={styles.choix}>
            <span>{libelle}</span>
            <input
              type="checkbox"
              className={styles.case}
              checked={cochee}
              disabled={plein && !cochee}
              onChange={() => { onChange(cochee ? choisies.filter((c) => c !== cle) : [...choisies, cle]) }}
            />
          </label>
        )
      })}
    </div>
  )
}

/** L'accueil : le mot d'Uriel, le cadeau promis. `children` : ce qui suit (le formulaire du lien, sans lien). */
function Accueil({ prenom, children }: { prenom: string | null; children?: ReactNode }) {
  return (
    <>
      <header className={styles.intitule}>
        <p className={styles.numero}>{prenom ? `Bonjour ${prenom}` : 'Bonjour'}</p>
        <h2 className={styles.grand}>Apprenons à nous connaître</h2>
      </header>
      <p className={styles.texte}>Pour que je sache qui tu es, et que les prochains Fragments te ressemblent. Je lis chaque réponse.</p>
      <p className={styles.signature}>— Uriel, fondateur de Runes de Chêne</p>
      <div className={styles.encart}>
        <img src={cadeau} alt="" className={styles.petitCadeau} />
        <p className={styles.mot}>
          <strong>Un cadeau t’attend à la fin</strong>
          <span className={styles.precision}>Rien n’est obligatoire : chaque question se passe.</span>
        </p>
      </div>
      {children}
      <p className={styles.legal}>
        Tes réponses restent chez nous, sur ta fiche. Elles servent à t’écrire des lettres qui te ressemblent, jamais à
        autre chose. <a href={DONNEES_PERSONNELLES}>Données personnelles</a>
      </p>
    </>
  )
}

function Merci({ prenom, compte }: { prenom: string | null; compte: boolean }) {
  return (
    <Fenetre
      etape={DERNIERE + 1}
      sous="Sept sur sept · tout est noté"
      pied={<LienBouton href={BOUTIQUE} className={styles.large}>Choisir mon premier Fragment</LienBouton>}
    >
      <div className={styles.merci}>
        <img src={cadeau} alt="" className={styles.cadeau} />
        <header className={styles.intitule}>
          <p className={styles.numero}>Merci, {prenom ?? 'Explorateur'}</p>
          <h2 className={styles.grand}>C’est noté</h2>
        </header>
        <p className={styles.texte}>Je lis chaque réponse. Et ton cadeau t’attend :</p>
        <div className={styles.pin}>
          <strong>Le pin de la Rune</strong>
          <span>offert avec ton premier Fragment</span>
        </div>
        {compte && (
          <p className={styles.compte}>
            ✓ Ton compte Explore est prêt : entre avec ton adresse sur <a href={EXPLORE}>app.runesdechene.com</a>.
          </p>
        )}
      </div>
    </Fenetre>
  )
}

/** Sans lien personnel : l'adresse, et le lien part par e-mail si une fiche la porte. */
function DemanderLeLien({ perime = false }: { perime?: boolean }) {
  const [email, setEmail] = useState('')
  const [etat, setEtat] = useState<'attente' | 'envoi' | 'fait' | 'erreur'>('attente')

  async function envoyer(e: SubmitEvent) {
    e.preventDefault()
    setEtat('envoi')
    const r = await fetch(FONCTION, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) })
      .catch(() => null)
    setEtat(r?.ok ? 'fait' : 'erreur')
  }

  return (
    <Fenetre etape={0} sous="Sept questions, deux minutes">
      <Accueil prenom={null}>
        {etat === 'fait' ? (
          <p className={styles.texte}>Regarde ta boîte : si ton adresse est chez nous, ton lien pour répondre t’y attend.</p>
        ) : (
          <form className={styles.lien} onSubmit={(e) => void envoyer(e)}>
            {perime && <MessageDErreur>Ce lien ne fonctionne plus. Demande-en un nouveau ci-dessous.</MessageDErreur>}
            <p className={styles.texte}>Donne ton e-mail : je t’envoie ton lien pour répondre.</p>
            <Champ libelle="Ton e-mail" type="email" required value={email} onChange={(e) => { setEmail(e.target.value) }} />
            {etat === 'erreur' && <MessageDErreur>Le lien n’a pas pu partir, réessaie dans un instant.</MessageDErreur>}
            <BoutonSombre type="submit" disabled={etat === 'envoi'}>{etat === 'envoi' ? 'Un instant…' : 'Recevoir mon lien'}</BoutonSombre>
          </form>
        )}
      </Accueil>
    </Fenetre>
  )
}

/** Une question selon son rang (1 à 7) : les quatre à cases, puis l'attente, la région, l'anniversaire. */
function Ecran({ n, reponses, changer, compte, setCompte }: {
  n: number
  reponses: Reponses
  changer: (r: Partial<Reponses>) => void
  compte: boolean
  setCompte: (compte: boolean) => void
}) {
  const q = A_CASES[n - 1]
  if (q) {
    // Une réponse « autre » cochée ouvre son champ, pour dire laquelle.
    const libre = QUESTIONS[q].libre
    return (
      <>
        <Intitule n={n} titre={QUESTIONS[q].titre} aide={QUESTIONS[q].aide} />
        <Cases q={q} choisies={reponses[q]} onChange={(choisies) => { changer({ [q]: choisies }) }} />
        {libre && reponses[q].includes(libre.reponse) && (
          <input
            className={etape.champ}
            aria-label={libre.invite}
            placeholder={libre.invite}
            maxLength={LIBRE_MAX}
            value={reponses[libre.champ] ?? ''}
            onChange={(e) => { changer({ [libre.champ]: e.target.value || null }) }}
          />
        )}
      </>
    )
  }
  if (n === 5) {
    const attente = reponses.attente ?? ''
    return (
      <>
        <Intitule n={n} titre="Qu’attends-tu de nous ?" aide="Écris ce qui te vient." />
        <textarea
          className={`${etape.champ ?? ''} ${styles.zone ?? ''}`}
          aria-label="Ta réponse"
          maxLength={1000}
          rows={7}
          placeholder="Plus d’histoires sur les Celtes, une collection d’hiver…"
          value={attente}
          onChange={(e) => { changer({ attente: e.target.value || null }) }}
        />
        <p className={styles.compteur}>{attente.length} / 1000</p>
      </>
    )
  }
  if (n === 6) {
    return (
      <>
        <Intitule n={n} titre="Où vis-tu ?" aide={null} />
        <select className={etape.champ} aria-label="Ton département" value={reponses.departement ?? ''} onChange={(e) => { changer({ departement: e.target.value || null }) }}>
          <option value="">Choisir ton département</option>
          {[...DEPARTEMENTS, 'Hors de France'].map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </>
    )
  }
  return (
    <>
      <Intitule n={n} titre="Ton anniversaire" aide="Pour te le souhaiter, rien d’autre." />
      <div className={styles.date}>
        <label className={styles.carte}>
          <span>Jour</span>
          <select value={reponses.anniv_jour ?? ''} onChange={(e) => { changer({ anniv_jour: e.target.value ? Number(e.target.value) : null }) }}>
            <option value="">Choisir</option>
            {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
        </label>
        <label className={styles.carte}>
          <span>Mois</span>
          <select value={reponses.anniv_mois ?? ''} onChange={(e) => { changer({ anniv_mois: e.target.value ? Number(e.target.value) : null }) }}>
            <option value="">Choisir</option>
            {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.encart}>
        <CaseACocher checked={compte} onChange={(e) => { setCompte(e.target.checked) }}>
          <strong>Créer aussi mon compte Explore</strong>
          <span className={styles.precision}>
            Avec l’adresse de cet e-mail, sans mot de passe à choisir. Tu y retrouveras tes Fragments et la carte des lieux.
          </span>
        </CaseACocher>
      </div>
    </>
  )
}

function Questionnaire({ jeton, epoque, n, aller }: { jeton: string; epoque: string | null; n: number; aller: (n: number) => void }) {
  const [reponses, setReponses] = useState<Reponses | null>(null)
  const [prenom, setPrenom] = useState<string | null>(null)
  const [compte, setCompte] = useState(false)
  const [compteCree, setCompteCree] = useState(false)
  const [etat, setEtat] = useState<'lecture' | 'pret' | 'envoi' | 'fait' | 'lien' | 'panne' | 'erreur'>('lecture')

  useEffect(() => {
    void (async () => {
      const r = await fetch(`${FONCTION}?j=${encodeURIComponent(jeton)}`).catch(() => null)
      if (!r?.ok) {
        setEtat(r?.status === 403 ? 'lien' : 'panne')
        return
      }
      const lu = (await r.json()) as Lecture
      const depart = lu.portrait ?? VIDE
      // L'époque du lien se coche en plus des réponses d'avant, dans la limite de deux.
      const epoques = epoque && !depart.epoques.includes(epoque) && depart.epoques.length < 2 && QUESTIONS.epoques.reponses.some(([c]) => c === epoque)
        ? [...depart.epoques, epoque]
        : depart.epoques
      setPrenom(lu.prenom)
      setReponses({ ...depart, epoques })
      setEtat('pret')
    })()
  }, [jeton, epoque])

  if (etat === 'lien') return <DemanderLeLien perime />
  if (etat === 'fait') return <Merci prenom={prenom} compte={compteCree} />
  if (etat === 'panne' || !reponses) {
    return (
      <Fenetre etape={0} sous="Sept questions, deux minutes">
        {etat === 'panne' ? <MessageDErreur>La page n’a pas pu se charger, réessaie dans un instant.</MessageDErreur> : <p className={styles.texte}>Un instant…</p>}
      </Fenetre>
    )
  }

  async function envoyer(e: SubmitEvent) {
    e.preventDefault()
    setEtat('envoi')
    const r = await fetch(FONCTION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jeton, reponses, compte }),
    }).catch(() => null)
    if (r?.ok) {
      const recu = (await r.json()) as { prenom: string | null; compte?: boolean }
      setPrenom(recu.prenom)
      setCompteCree(recu.compte === true)
      setEtat('fait')
    } else {
      setEtat('erreur')
    }
  }

  if (n === 0) {
    return (
      <Fenetre
        etape={0}
        sous="Sept questions, deux minutes"
        pied={<><span className={styles.duree}>≈ 2 minutes</span><BoutonSombre onClick={() => { aller(1) }}>Commencer →</BoutonSombre></>}
      >
        <Accueil prenom={prenom} />
      </Fenetre>
    )
  }

  return (
    <form className={styles.formulaire} onSubmit={(e) => void envoyer(e)}>
      <Fenetre
        etape={n}
        sous={`Question ${String(n)} sur ${String(DERNIERE)} · ${ETAPES[n - 1] ?? ''}`}
        pied={
          <>
            <button type="button" className={styles.precedent} onClick={() => { aller(n - 1) }}>← Précédent</button>
            {n < DERNIERE ? (
              <BoutonSombre onClick={() => { aller(n + 1) }}>Suivant →</BoutonSombre>
            ) : (
              <BoutonSombre type="submit" disabled={etat === 'envoi'}>{etat === 'envoi' ? 'Un instant…' : 'Envoyer mes réponses'}</BoutonSombre>
            )}
          </>
        }
      >
        <Ecran n={n} reponses={reponses} changer={(r) => { setReponses({ ...reponses, ...r }) }} compte={compte} setCompte={setCompte} />
        {etat === 'erreur' && <MessageDErreur>Tes réponses n’ont pas pu partir. Vérifie la date d’anniversaire, puis réessaie.</MessageDErreur>}
      </Fenetre>
    </form>
  )
}

export function PageQuestionnaire() {
  const [parametres, setParametres] = useSearchParams()
  const jeton = parametres.get('j')
  // Une question tapée à la main hors de 0 à 7 ramène à l'accueil.
  const brut = Number(parametres.get('q') ?? 0)
  const n = Number.isInteger(brut) && brut >= 0 && brut <= DERNIERE ? brut : 0

  function aller(suivant: number) {
    setParametres((p) => {
      const suite = new URLSearchParams(p)
      suite.set('q', String(suivant))
      return suite
    })
  }

  return (
    <PagePublique titre="Dis-nous qui tu es — Runes de Chêne" disposition="carte" photo={<img className={styles.photo} src={shooting} alt="" />}>
      {jeton ? <Questionnaire jeton={jeton} epoque={parametres.get('epoque')} n={n} aller={aller} /> : <DemanderLeLien />}
    </PagePublique>
  )
}
