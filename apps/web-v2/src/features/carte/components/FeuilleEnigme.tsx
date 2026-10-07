/**
 * QUOI     — une énigme touchée sur la carte : le sceau se retourne, puis la feuille monte — « Énigme »
 *            et sa culture, le récit, la question, les réponses lettrées ; après la réponse, le verdict.
 * POURQUOI — maquettes « Énigmes — 3 » et « 5b à 5d », et la feuille redessinée « A » (Figma 484:434,
 *            choisie par Uriel le 07/10 : la première version n'était « pas sexy » et peu lisible). Une seule réponse (QCM : un bouton par
 *            choix ; libre : un champ) ; le verdict (VerdictEnigme) fête la bonne réponse et, juste ou
 *            fausse, montre « Le savais-tu ? » — ce qui compte, c'est d'apprendre.
 */
import { useState } from 'react'
import { Feuille } from '@/shared/ui/Feuille'
import { Text } from '@/shared/ui/Text'
import type { EnigmeOuverte, Verdict } from '../api/lireEnigmes'
import type { EnigmeTouchee } from '../hooks/useEnigmesSurLaCarte'
import { useEnigme } from '../hooks/useEnigme'
import { piedEnClair } from '../lib/enigmeEnClair'
import { SceauQuiSeRetourne } from './SceauQuiSeRetourne'
import { BilanDuVerdict, FeteDuVerdict } from './VerdictEnigme'
import styles from './FeuilleEnigme.module.css'

export function FeuilleEnigme({ touchee, onFermer }: { touchee: EnigmeTouchee; onFermer: () => void }) {
  const { enigme, erreurOuverture, repondre, verdict, envoi, erreurReponse } = useEnigme(touchee.id)
  const [retourne, setRetourne] = useState(false)
  const [choisie, setChoisie] = useState<string | null>(null)

  if (erreurOuverture) {
    return (
      <Feuille titre="Énigme" onFermer={onFermer}>
        <div className={styles.contenu}>
          <Text variant="corps">Cette énigme s’est rendormie.</Text>
        </div>
      </Feuille>
    )
  }

  if (!retourne || !enigme) {
    return (
      <SceauQuiSeRetourne
        x={touchee.x}
        y={touchee.y}
        culture={enigme?.culture ?? null}
        onFini={() => {
          if (enigme) setRetourne(true)
        }}
      />
    )
  }

  const envoyer = (r: string) => {
    if (envoi || verdict) return
    setChoisie(r)
    repondre(r)
  }

  return (
    <Feuille titre={`Énigme · ${enigme.culture.nom}`} onFermer={onFermer}>
      <div
        className={styles.contenu}
        style={enigme.culture.couleur ? { '--couleur-culture': enigme.culture.couleur } : undefined}
      >
        <header className={styles.entete}>
          {/* Le sceau de la culture : son icône du Hub, ou son initiale si elle n'en a pas. */}
          <span className={styles.sceau} data-testid="sceau-culture">
            {enigme.culture.icone ? <img src={enigme.culture.icone} alt="" /> : enigme.culture.nom.charAt(0)}
          </span>
          <span className={styles.titre}>
            <span className={styles.surtitre}>Énigme</span>
            <span className={styles.culture}>{enigme.culture.nom}</span>
          </span>
        </header>
        {verdict ? <FeteDuVerdict verdict={verdict} /> : <p className={styles.recit}>{enigme.recit}</p>}
        {verdict ? <Text variant="legende">{enigme.question}</Text> : <p className={styles.question}>{enigme.question}</p>}
        {/* Un titre gagné prend la place : les réponses se replient (maquette 5d). */}
        {!verdict?.nouveauxTitres.length && (
          <Reponses enigme={enigme} verdict={verdict} choisie={choisie} envoi={envoi} onRepondre={envoyer} />
        )}
        {erreurReponse && <Text variant="legende">{erreurReponse}</Text>}
        {verdict && <BilanDuVerdict verdict={verdict} culture={enigme.culture.nom} />}
        <Text variant="legende">
          {verdict ? piedEnClair(verdict.resteEnAttente) : 'Une seule réponse. Juste : +1 XP et des points de connaissance.'}
        </Text>
      </div>
    </Feuille>
  )
}

function Reponses({
  enigme,
  verdict,
  choisie,
  envoi,
  onRepondre,
}: {
  enigme: EnigmeOuverte
  verdict: Verdict | undefined
  choisie: string | null
  envoi: boolean
  onRepondre: (r: string) => void
}) {
  const [libre, setLibre] = useState('')
  if (enigme.format === 'free' || !enigme.choix) {
    return (
      <form
        className={styles.libre}
        onSubmit={(e) => {
          e.preventDefault()
          if (libre.trim()) onRepondre(libre.trim())
        }}
      >
        <input
          className={styles.champ}
          value={libre}
          disabled={envoi || verdict !== undefined}
          onChange={(e) => {
            setLibre(e.target.value)
          }}
          aria-label="Ta réponse"
          placeholder="Ta réponse"
        />
        {!verdict && (
          <button type="submit" className={styles.envoyer} disabled={envoi || !libre.trim()}>
            Répondre
          </button>
        )}
      </form>
    )
  }
  return (
    <div className={styles.choix}>
      {enigme.choix.map((c, i) => (
        <button
          key={c}
          type="button"
          className={styles.choixBouton}
          disabled={envoi || verdict !== undefined}
          data-juste={verdict && c === verdict.reponse ? true : undefined}
          data-fausse={verdict && c === choisie && !verdict.juste ? true : undefined}
          onClick={() => {
            onRepondre(c)
          }}
        >
          <span className={styles.lettre} aria-hidden="true">
            {'ABCDEFGH'.charAt(i)}
          </span>
          {c}
        </button>
      ))}
    </div>
  )
}
