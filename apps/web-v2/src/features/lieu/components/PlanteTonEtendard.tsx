/**
 * QUOI     — « Plante ton étendard » (maquette 679:1676) : le nom de la revendication, choisi parmi
 *            mon nom et mes Compagnies ou écrit à la main ; les Explorateurs présents, à cocher ;
 *            puis planter.
 * POURQUOI — spec « Revendiquer par GPS » (Uriel, 21/10). Toucher une Compagnie revendique « pour »
 *            elle ; retoucher le nom ensuite fait tomber le « pour ». En groupe, le nom est
 *            obligatoire (ou celui d'une Compagnie) : mon nom seul n'y est plus proposé.
 * ATTENTION — le bruitage part au toucher (le navigateur ne laisse jouer un son que dans un geste) ;
 *            son coup sourd tombe à l'impact de « Conquis ! ».
 */
import { useState } from 'react'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Champ } from '@/shared/ui/Champ'
import { PastilleChoix } from '@/shared/ui/PastilleChoix'
import type { Conquete } from '../api/lireLieu'
import { useRevendication } from '../hooks/useRevendication'
import styles from './PlanteTonEtendard.module.css'

const BRUITAGE = `${import.meta.env.BASE_URL}res/etendard-plante.mp3`

export function PlanteTonEtendard({
  fiche,
  monNom,
  onConquis,
  onFermer,
}: {
  fiche: { id: string; nom: string }
  monNom: string
  onConquis: (conquete: Conquete) => void
  onFermer: () => void
}) {
  const { compagnons, compagnies, revendiquer, enCours, erreur } = useRevendication(fiche.id, true)
  const [nom, setNom] = useState(monNom)
  const [pour, setPour] = useState<string | null>(null)
  const [coches, setCoches] = useState<ReadonlySet<string>>(new Set())
  const [envoye, setEnvoye] = useState(false) // un double toucher ne plante qu'une fois

  // Seuls comptent les cochés encore présents : un compagnon parti ne bloque rien.
  const choisis = compagnons.filter((c) => coches.has(c.id)).map((c) => c.id)
  const enGroupe = choisis.length > 0
  const pret = !enCours && !envoye && (!enGroupe || nom.trim() !== '')

  function choisirNom(texte: string, compagnie: string | null) {
    setNom(texte)
    setPour(compagnie)
  }

  function saisir(texte: string) {
    setNom(texte)
    if (texte !== compagnies.find((c) => c.id === pour)?.nom) setPour(null)
  }

  function cocher(id: string) {
    const apres = new Set(coches)
    if (apres.has(id)) apres.delete(id)
    else apres.add(id)
    setCoches(apres)
    if (apres.size > 0 && nom.trim() === monNom) setNom('') // un groupe ne porte pas mon seul nom
  }

  function planter() {
    setEnvoye(true)
    const son = new Audio(BRUITAGE)
    void son.play().catch(() => undefined) // téléphone en silencieux : tant pis
    revendiquer(choisis, nom.trim() || null, pour).then(onConquis, () => {
      son.pause() // pas d'applaudissements sur un refus
      setEnvoye(false) // le refus est écrit par `erreur`
    })
  }

  return (
    <div className={styles.ecran}>
      <div className={styles.contenu}>
        <p className={styles.lieu}>{fiche.nom}</p>
        <span className={styles.etendard} aria-hidden="true" />
        <h2 className={styles.titre}>PLANTE TON ÉTENDARD</h2>
        <p className={styles.phrase}>
          Revendique ce lieu : ton nom y flottera, jusqu’à ce qu’un autre vienne le reprendre.
        </p>

        <div className={styles.champ}>
          <Champ libelle="Nom de ta revendication" valeur={nom} onChange={saisir} max={40} />
        </div>
        <div className={styles.pastilles}>
          <div className={styles.defile}>
            {!enGroupe && (
              <PastilleChoix
                libelle={monNom}
                choisie={pour === null && nom === monNom}
                onClick={() => {
                  choisirNom(monNom, null)
                }}
              />
            )}
            {compagnies.map((c) => (
              <PastilleChoix
                key={c.id}
                libelle={c.nom}
                choisie={pour === c.id}
                onClick={() => {
                  choisirNom(c.nom, c.id)
                }}
              />
            ))}
          </div>
        </div>

        {compagnons.length > 0 && (
          <div className={styles.avecToi}>
            <p className={styles.libelle}>Avec toi</p>
            {compagnons.map((c) => (
              <label key={c.id} className={styles.compagnon}>
                <Avatar url={c.avatar} nom={c.nom} taille="petit" />
                <span className={styles.nom}>{c.nom}</span>
                <input
                  type="checkbox"
                  checked={coches.has(c.id)}
                  onChange={() => {
                    cocher(c.id)
                  }}
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <div className={styles.pied}>
        {erreur && (
          <p role="alert" className={styles.erreur}>
            {erreur}
          </p>
        )}
        <Button disabled={!pret} onClick={planter}>
          Planter mon étendard
        </Button>
        <Button kind="discret" onClick={onFermer}>
          Pas maintenant — revenir à la carte
        </Button>
      </div>
    </div>
  )
}
