/**
 * QUOI     — la fenêtre après une visite réussie (maquette 232:128) : revendiquer le lieu seul,
 *            ou en expédition avec les Explorateurs présents autour, sous un nom choisi.
 * POURQUOI — spec fiche §5 : « pour la gloire ». Elle s'ouvre visite déjà marquée : « Passer
 *            cette étape » la garde, sans revendiquer (Uriel, 28/09). Les
 *            compagnons sont ceux que le serveur voit là maintenant ; il revérifie au moment de
 *            revendiquer.
 */
import { useState } from 'react'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Champ } from '@/shared/ui/Champ'
import { Feuille } from '@/shared/ui/Feuille'
import { PastilleChoix } from '@/shared/ui/PastilleChoix'
import { Segments } from '@/shared/ui/Segments'
import type { FicheLieu } from '../api/lireLieu'
import { useRevendication } from '../hooks/useRevendication'
import styles from './FenetreRevendication.module.css'

type Mode = 'seul' | 'expedition'
const MODES = [
  { id: 'seul', libelle: 'Seul' },
  { id: 'expedition', libelle: 'En expédition' },
] as const

export function FenetreRevendication({
  fiche,
  onFermer,
}: {
  fiche: Pick<FicheLieu, 'id' | 'nom'>
  onFermer: () => void
}) {
  const { compagnons, noms, compagnies, revendiquer, enCours, erreur } = useRevendication(
    fiche.id,
    true,
  )
  const [pour, setPour] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('seul')
  const [coches, setCoches] = useState<ReadonlySet<string>>(new Set())
  const [nom, setNom] = useState('')

  // Seuls comptent les cochés encore présents : un compagnon parti ne bloque rien.
  const choisis = compagnons.filter((c) => coches.has(c.id)).map((c) => c.id)
  const enGroupe = mode === 'expedition' && choisis.length > 0
  const pret = !enCours && (!enGroupe || nom.trim() !== '')

  function cocher(id: string) {
    setCoches((avant) => {
      const apres = new Set(avant)
      if (apres.has(id)) apres.delete(id)
      else apres.add(id)
      return apres
    })
  }

  function valider() {
    const envoi = enGroupe ? revendiquer(choisis, nom.trim(), pour) : revendiquer([], null, pour)
    envoi.then(onFermer, () => undefined) // l'échec est écrit par `erreur`
  }

  return (
    <Feuille titre="Revendiquer ce lieu" onFermer={onFermer}>
      <h2 className={styles.titre}>Revendiquer ce lieu</h2>
      <p className={styles.intro}>
        {fiche.nom} : ton nom s’inscrira sous son sceau, pour la gloire — jusqu’à ce qu’un autre
        vienne le reprendre.
      </p>

      <Segments libelle="Seul ou en expédition" options={MODES} valeur={mode} onChange={setMode} />

      {mode === 'expedition' && (
        <div className={styles.expedition}>
          <p className={styles.libelle}>Qui est avec toi ?</p>
          {compagnons.length === 0 ? (
            <p className={styles.aide}>Personne d’autre n’est ici en ce moment</p>
          ) : (
            <>
              <p className={styles.aide}>Les Explorateurs ici en ce moment, à moins de 200 m.</p>
              {compagnons.map((c) => (
                <label key={c.id} className={styles.compagnon}>
                  <Avatar url={c.avatar} nom={c.nom} taille="petit" />
                  <span className={styles.texte}>
                    <span className={styles.nom}>{c.nom}</span>
                    <span className={styles.distance}>à {c.distance} m</span>
                  </span>
                  <input
                    type="checkbox"
                    className={styles.case}
                    checked={coches.has(c.id)}
                    onChange={() => {
                      cocher(c.id)
                    }}
                  />
                </label>
              ))}
              <Champ libelle="Nom de l’expédition" valeur={nom} onChange={setNom} max={40} />
              {noms.length > 0 && (
                <div className={styles.noms}>
                  {noms.map((n) => (
                    <PastilleChoix
                      key={n}
                      libelle={n}
                      choisie={n === nom.trim()}
                      onClick={() => {
                        setNom(n)
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {compagnies.length > 0 && (
        <div className={styles.expedition}>
          <p className={styles.libelle}>Pour une Compagnie (facultatif)</p>
          <div className={styles.noms}>
            <PastilleChoix
              libelle="Aucune"
              choisie={pour === null}
              onClick={() => {
                setPour(null)
              }}
            />
            {compagnies.map((c) => (
              <PastilleChoix
                key={c.id}
                libelle={c.nom}
                choisie={pour === c.id}
                onClick={() => {
                  setPour(c.id)
                }}
              />
            ))}
          </div>
          <p className={styles.aide}>
            La fiche du lieu dira « pour{' '}
            {compagnies.find((c) => c.id === pour)?.nom ?? 'ta Compagnie'} », et le lieu rejoindra «
            Leurs lieux ». La carte garde ton nom.
          </p>
        </div>
      )}

      {erreur && (
        <p role="alert" className={styles.erreur}>
          {erreur}
        </p>
      )}
      <Button disabled={!pret} onClick={valider}>
        Revendiquer
      </Button>
      <Button kind="discret" onClick={onFermer}>
        Passer cette étape
      </Button>
    </Feuille>
  )
}
