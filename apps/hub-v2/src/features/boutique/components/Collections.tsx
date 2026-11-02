/**
 * QUOI     — « Les collections du Codex » : une ligne par collection des Fragments, avec sa pastille
 *            (sa couleur et son icône, comme l'en-tête de sa section au Codex), son titre gagné quand
 *            on la porte entière, et « Enregistrer ».
 * POURQUOI — le Codex range les Fragments par collection thématique et les teinte (maquette F,
 *            02/11). Une nouvelle icône part tout de suite au bucket des icônes, l'ancienne n'en est
 *            retirée qu'après l'enregistrement (useIconeEnvoyee).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type CSSProperties } from 'react'
import { useIconeEnvoyee } from '@/shared/hooks/useIconeEnvoyee'
import { couleurValide } from '@/shared/lib/couleur'
import { extensionDe } from '@/shared/lib/envoi'
import { Bloc } from '@/shared/ui/Bloc'
import { Bouton } from '@/shared/ui/Bouton'
import { ecrireCollection, lireCollections, type CollectionDuCodex } from '../api/collections'
import styles from './Collections.module.css'

const CLE = ['hub-codex-collections'] as const
const BUCKET = 'tag-icons'
const TYPES_D_ICONE = ['image/svg+xml', 'image/png', 'image/webp']

function LigneDeCollection({ heritage, fiche }: { heritage: string; fiche: CollectionDuCodex | undefined }) {
  const client = useQueryClient()
  const [couleur, setCouleur] = useState(fiche?.couleur ?? '')
  const [titre, setTitre] = useState(fiche?.titre ?? '')
  const [refus, setRefus] = useState<string | null>(null)
  const { icone, envoiEnCours, refus: refusIcone, choisir, apresEnregistrement } = useIconeEnvoyee(BUCKET, fiche?.icone_url ?? null)
  const ecriture = useMutation({
    mutationFn: (c: Parameters<typeof ecrireCollection>[0]) => ecrireCollection(c),
    onSuccess: () => {
      apresEnregistrement()
      void client.invalidateQueries({ queryKey: CLE })
    },
  })

  function enregistrer() {
    const erreur = couleur && !couleurValide(couleur) ? 'La couleur s’écrit #RRGGBB.' : null
    setRefus(erreur)
    if (!erreur) ecriture.mutate({ heritage, couleur, icone_url: icone, titre })
  }

  return (
    <fieldset className={styles.ligne} aria-label={heritage} style={couleurValide(couleur) ? ({ '--couleur': couleur } as CSSProperties) : undefined}>
      <span className={styles.pastille} aria-hidden="true">
        {icone && <img src={icone} alt="" />}
      </span>
      <strong className={styles.nom}>{heritage}</strong>
      <label className={styles.champ}>Couleur
        <input value={couleur} placeholder="#RRGGBB" onChange={(e) => { setCouleur(e.target.value); ecriture.reset() }} />
      </label>
      <label className={styles.champ}>Titre de la collection complète
        <input value={titre} placeholder="Gardien du Pacte" onChange={(e) => { setTitre(e.target.value); ecriture.reset() }} />
      </label>
      <label className={styles.champ}>Icône
        <input
          type="file" accept={TYPES_D_ICONE.join(',')} disabled={envoiEnCours}
          onChange={(e) => void choisir(e, { types: TYPES_D_ICONE }, (f) => `codex/${String(Date.now())}.${extensionDe(f)}`)}
        />
      </label>
      <span className={styles.actions}>
        <Bouton sorte="secondaire" disabled={ecriture.isPending || envoiEnCours} onClick={enregistrer}>Enregistrer</Bouton>
        {ecriture.isSuccess && <span role="status">Enregistré.</span>}
      </span>
      {(refus ?? refusIcone ?? (ecriture.isError ? ecriture.error.message : null)) && (
        <p className={styles.alerte} role="alert">{refus ?? refusIcone ?? ecriture.error?.message}</p>
      )}
    </fieldset>
  )
}

export function Collections({ heritages }: { heritages: (string | null)[] }) {
  const { data } = useQuery({ queryKey: CLE, queryFn: lireCollections })
  const noms = [...new Set(heritages.filter((h): h is string => Boolean(h)))].sort()
  if (!data || noms.length === 0) return null
  return (
    <section className={styles.collections}>
      <h2 className={styles.titre}>Les collections du Codex</h2>
      <p className={styles.calme}>La couleur et l’icône de chaque collection au Codex, et le titre de qui la porte entière.</p>
      <Bloc>
        {noms.map((h) => <LigneDeCollection key={h} heritage={h} fiche={data.find((c) => c.heritage === h)} />)}
      </Bloc>
    </section>
  )
}
