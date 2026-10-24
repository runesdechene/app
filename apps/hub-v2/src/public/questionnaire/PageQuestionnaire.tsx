/**
 * QUOI     — /qui-es-tu, « Dis-nous qui tu es » (maquette 750:2520, merci 750:2669) : sept questions, puis
 *            « C'est noté » et le pin promis. Les réponses vont à la fonction `questionnaire`.
 * POURQUOI — sans compte : le lien signé de la Missive (?j=) dit qui répond. Un lien d'époque (?epoque=celtes)
 *            la coche, mais rien ne s'écrit avant « Envoyer mes réponses » : les messageries d'entreprise
 *            ouvrent seules les liens. Sans lien, la page demande l'e-mail et envoie le lien, rien d'autre.
 *            Parchemin et colonne de /flyercadeau ; l'écran de fin reprend ses styles (le code devient le pin).
 */
import { QUESTIONS, type Question, type Reponses } from '@runes/missives'
import { useEffect, useState, type SubmitEvent } from 'react'
import { useSearchParams } from 'react-router'
import cadeau from '@/assets/flyer/cadeau.webp'
import fond from '@/assets/flyer/fond-parchemin-entrelacs.webp'
import { Bouton, LienBouton } from '../briques/Bouton'
import { CaseACocher } from '../briques/CaseACocher'
import { Champ } from '../briques/Champ'
import champ from '../briques/Champ.module.css'
import { MessageDErreur } from '../briques/MessageDErreur'
import { PhotoFlyer } from '../briques/PhotoFlyer'
import fin from '../cadeau/PageCadeau.module.css'
import { PagePublique } from '../PagePublique'
import { DEPARTEMENTS } from '../soumettre/lib/departements'
import styles from './PageQuestionnaire.module.css'

const FONCTION = '/.netlify/functions/questionnaire'
const BOUTIQUE = 'https://runesdechene.com'
const DONNEES_PERSONNELLES = 'https://app.runesdechene.com/legal/confidentialite'
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const VIDE: Reponses = { epoques: [], decouverte: [], amene: [], plait: [], attente: null, departement: null, anniv_jour: null, anniv_mois: null }

type Lecture = { prenom: string | null; portrait: Reponses | null }

function Titre({ surtitre, titre }: { surtitre: string; titre: string }) {
  return (
    <h1 className={fin.titre}>
      <span className={fin.surtitre}>{surtitre}</span> <span>{titre}</span>
    </h1>
  )
}

/** Une question à cases : `max` atteint, les autres cases se figent. */
function Cases({ q, choisies, onChange }: { q: Question; choisies: string[]; onChange: (choisies: string[]) => void }) {
  const { titre, aide, max, reponses } = QUESTIONS[q]
  const plein = max !== null && choisies.length >= max
  return (
    <fieldset className={styles.question}>
      <legend className={styles.intitule}>{titre}</legend>
      {aide && <p className={styles.aide}>{aide}</p>}
      {reponses.map(([cle, libelle]) => {
        const cochee = choisies.includes(cle)
        return (
          <CaseACocher
            key={cle}
            checked={cochee}
            disabled={plein && !cochee}
            onChange={() => { onChange(cochee ? choisies.filter((c) => c !== cle) : [...choisies, cle]) }}
          >
            {libelle}
          </CaseACocher>
        )
      })}
    </fieldset>
  )
}

function EnTete() {
  return (
    <>
      <Titre surtitre="Sept questions, deux minutes" titre="Pour te connaître" />
      <p className={fin.texte}>Pour que je sache qui tu es, et que les prochains Fragments te ressemblent. Je lis chaque réponse. — Uriel</p>
    </>
  )
}

function Merci({ prenom }: { prenom: string | null }) {
  return (
    <div className={fin.etape}>
      <div className={fin.haut}>
        <img src={cadeau} alt="" className={fin.cadeau} />
        <Titre surtitre={`Merci, ${prenom ?? 'Explorateur'}`} titre="C’est noté" />
        <p className={fin.texte}>Je lis chaque réponse. Et ton cadeau t’attend :</p>
        <div className={fin.code}>
          <strong className={fin.valeur}>Le pin de la Rune</strong>
          <span className={fin.lien}>offert avec ton premier Fragment</span>
        </div>
      </div>
      <div className={fin.action}>
        <LienBouton href={BOUTIQUE}>Choisir mon premier Fragment</LienBouton>
        <p className={fin.aBientot}>À bientôt sur les chemins, Explorateur !</p>
        <p className={fin.pied}>
          <a href={DONNEES_PERSONNELLES}>Données personnelles</a>
        </p>
      </div>
    </div>
  )
}

/** Sans lien personnel : l'adresse, et le lien part par e-mail si une fiche la porte. */
function DemanderLeLien() {
  const [email, setEmail] = useState('')
  const [etat, setEtat] = useState<'attente' | 'envoi' | 'fait' | 'erreur'>('attente')

  async function envoyer(e: SubmitEvent) {
    e.preventDefault()
    setEtat('envoi')
    const r = await fetch(FONCTION, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) })
      .catch(() => null)
    setEtat(r?.ok ? 'fait' : 'erreur')
  }

  if (etat === 'fait') {
    return <p className={fin.texte}>Regarde ta boîte : si ton adresse est chez nous, ton lien pour répondre t’y attend.</p>
  }
  return (
    <form className={styles.formulaire} onSubmit={(e) => void envoyer(e)}>
      <EnTete />
      <p className={fin.texte}>Donne ton e-mail : je t’envoie ton lien pour répondre.</p>
      <Champ libelle="Ton e-mail" type="email" required value={email} onChange={(e) => { setEmail(e.target.value) }} />
      {etat === 'erreur' && <MessageDErreur>Le lien n’a pas pu partir, réessaie dans un instant.</MessageDErreur>}
      <Bouton type="submit" disabled={etat === 'envoi'}>{etat === 'envoi' ? 'Un instant…' : 'Recevoir mon lien'}</Bouton>
    </form>
  )
}

function Questionnaire({ jeton, epoque }: { jeton: string; epoque: string | null }) {
  const [reponses, setReponses] = useState<Reponses | null>(null)
  const [prenom, setPrenom] = useState<string | null>(null)
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

  if (etat === 'lien') {
    return (
      <>
        <MessageDErreur>Ce lien ne fonctionne plus. Demande-en un nouveau ci-dessous.</MessageDErreur>
        <DemanderLeLien />
      </>
    )
  }
  if (etat === 'panne') return <MessageDErreur>La page n’a pas pu se charger, réessaie dans un instant.</MessageDErreur>
  if (etat === 'fait') return <Merci prenom={prenom} />
  if (!reponses) return <p className={fin.texte}>Un instant…</p>

  const changer = (r: Partial<Reponses>) => { setReponses({ ...reponses, ...r }) }

  async function envoyer(e: SubmitEvent) {
    e.preventDefault()
    setEtat('envoi')
    const r = await fetch(FONCTION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jeton, reponses }),
    }).catch(() => null)
    if (r?.ok) {
      setPrenom(((await r.json()) as { prenom: string | null }).prenom)
      setEtat('fait')
    } else {
      setEtat('erreur')
    }
  }

  return (
    <form className={styles.formulaire} onSubmit={(e) => void envoyer(e)}>
      <EnTete />
      {(Object.keys(QUESTIONS) as Question[]).map((q) => (
        <Cases key={q} q={q} choisies={reponses[q]} onChange={(choisies) => { changer({ [q]: choisies }) }} />
      ))}

      <div className={styles.question}>
        <p className={styles.intitule}>Qu’attends-tu de nous ?</p>
        <label className={champ.champ}>
          <span className={champ.libelle}>Ta réponse</span>
          <textarea
            className={`${champ.saisie ?? ''} ${styles.texte ?? ''}`}
            maxLength={1000}
            rows={3}
            placeholder="Plus d’histoires sur les Celtes…"
            value={reponses.attente ?? ''}
            onChange={(e) => { changer({ attente: e.target.value || null }) }}
          />
        </label>
      </div>

      <div className={styles.question}>
        <p className={styles.intitule}>Où vis-tu ?</p>
        <label className={champ.champ}>
          <span className={champ.libelle}>Ton département</span>
          <select className={champ.saisie} value={reponses.departement ?? ''} onChange={(e) => { changer({ departement: e.target.value || null }) }}>
            <option value="">Choisir</option>
            {[...DEPARTEMENTS, 'Hors de France'].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>

      <div className={styles.question}>
        <p className={styles.intitule}>Ton anniversaire</p>
        <p className={styles.aide}>Facultatif. Pour te le souhaiter, rien d’autre.</p>
        <div className={styles.anniversaire}>
          <label className={champ.champ}>
            <span className={champ.libelle}>Jour</span>
            <select className={champ.saisie} value={reponses.anniv_jour ?? ''} onChange={(e) => { changer({ anniv_jour: e.target.value ? Number(e.target.value) : null }) }}>
              <option value="">Choisir</option>
              {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
            </select>
          </label>
          <label className={champ.champ}>
            <span className={champ.libelle}>Mois</span>
            <select className={champ.saisie} value={reponses.anniv_mois ?? ''} onChange={(e) => { changer({ anniv_mois: e.target.value ? Number(e.target.value) : null }) }}>
              <option value="">Choisir</option>
              {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
        </div>
      </div>

      {etat === 'erreur' && <MessageDErreur>Tes réponses n’ont pas pu partir. Vérifie la date d’anniversaire, puis réessaie.</MessageDErreur>}
      <Bouton type="submit" disabled={etat === 'envoi'}>{etat === 'envoi' ? 'Un instant…' : 'Envoyer mes réponses'}</Bouton>
      <p className={fin.pied}>
        Tes réponses restent chez nous, sur ta fiche. Elles servent à t’écrire des lettres qui te ressemblent, jamais à autre
        chose. <a href={DONNEES_PERSONNELLES}>Données personnelles</a>
      </p>
    </form>
  )
}

export function PageQuestionnaire() {
  const [parametres] = useSearchParams()
  const jeton = parametres.get('j')
  return (
    <PagePublique titre="Dis-nous qui tu es — Runes de Chêne" photo={<PhotoFlyer telephone={false} />} fond={fond}>
      <div className={fin.page}>
        <a href={BOUTIQUE} className={fin.retour}>← Retourner sur la boutique</a>
        {jeton ? <Questionnaire jeton={jeton} epoque={parametres.get('epoque')} /> : <DemanderLeLien />}
      </div>
    </PagePublique>
  )
}
