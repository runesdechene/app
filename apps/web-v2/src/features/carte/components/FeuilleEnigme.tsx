/**
 * QUOI     — une énigme touchée sur la carte : le sceau se retourne, puis la feuille monte — la
 *            culture, le récit, la question, les réponses ; après la réponse, le verdict.
 * POURQUOI — maquettes « Énigmes — 3, 4, 5 ». Une seule réponse (QCM : un bouton par choix ; libre :
 *            un champ) ; juste ou fausse, « Le savais-tu ? » s'affiche — ce qui compte, c'est d'apprendre.
 */
import { useState } from 'react'
import { Feuille } from '@/shared/ui/Feuille'
import { Text } from '@/shared/ui/Text'
import type { EnigmeOuverte, Verdict } from '../api/lireEnigmes'
import type { EnigmeTouchee } from '../hooks/useEnigmesSurLaCarte'
import { useEnigme } from '../hooks/useEnigme'
import { connaissanceEnClair, gainsEnClair, piedEnClair, prochainEnClair } from '../lib/enigmeEnClair'
import { SceauQuiSeRetourne } from './SceauQuiSeRetourne'
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
      <div className={styles.contenu}>
        <header className={styles.entete}>
          <span className={styles.icone} style={enigme.culture.couleur ? { '--couleur-culture': enigme.culture.couleur } : undefined}>
            {enigme.culture.icone ? <img src={enigme.culture.icone} alt="" /> : null}
          </span>
          <Text variant="titre-section">{enigme.culture.nom}</Text>
        </header>
        <p className={styles.recit}>{enigme.recit}</p>
        <Text variant="corps">{enigme.question}</Text>
        <Reponses enigme={enigme} verdict={verdict} choisie={choisie} envoi={envoi} onRepondre={envoyer} />
        {erreurReponse && <Text variant="legende">{erreurReponse}</Text>}
        {verdict && <LeVerdict verdict={verdict} culture={enigme.culture.nom} />}
        <Text variant="legende">
          {verdict ? piedEnClair(verdict.resteEnAttente) : 'Une seule réponse. Si tu te trompes, tu découvres l’explication, sans points.'}
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
        {verdict && !verdict.juste && <Text variant="legende">{`La réponse : ${verdict.reponse}`}</Text>}
      </form>
    )
  }
  return (
    <div className={styles.choix}>
      {enigme.choix.map((c) => (
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
          {c}
        </button>
      ))}
    </div>
  )
}

function LeVerdict({ verdict, culture }: { verdict: Verdict; culture: string }) {
  return (
    <section className={styles.verdict} aria-live="polite">
      {verdict.juste && (
        <ul className={styles.gains}>
          {gainsEnClair(verdict, culture).map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      )}
      {verdict.nouveauxTitres.map((t) => (
        <Text key={t} variant="sous-titre">{`Te voilà ${t}.`}</Text>
      ))}
      <div className={styles.savais}>
        <Text variant="legende">Le savais-tu ?</Text>
        <Text variant="flux">{verdict.explication}</Text>
      </div>
      <Text variant="legende">{connaissanceEnClair(verdict.points, verdict.total, culture)}</Text>
      <Text variant="legende">{prochainEnClair(verdict, culture)}</Text>
    </section>
  )
}
