/**
 * QUOI     — l'onglet Codex (maquette F) : le compte de la collection, les filtres par collection,
 *            puis une section par collection thématique.
 * POURQUOI — le Codex est le Pokédex de Runes de Chêne (spec 2026-11-02-codex-design) : on doit
 *            avoir envie de compléter sa collection et de scanner le t-shirt des autres. Sous le
 *            titre, « Comment ça marche ? » ouvre l'explication (Uriel, 05/11 : un lien, point).
 */
import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Text } from '@/shared/ui/Text'
import { useCodex } from '../hooks/useCodex'
import { CommentCaMarche, LienExplication } from './CommentCaMarche'
import { CompteTotal } from './CompteTotal'
import { FiltresCollections } from './FiltresCollections'
import { SectionCollection } from './SectionCollection'
import styles from './CodexScreen.module.css'

export function CodexScreen() {
  const { codex, erreur, reessayer } = useCodex()
  const [choisie, choisir] = useState<string | null>(null)
  const [explication, setExplication] = useState(false)

  return (
    <section className={styles.ecran}>
      <header className={styles.entete}>
        <Text variant="titre-ecran">Le Codex</Text>
        <p className={styles.sousTitre}>Collectionne tes Fragments d’histoire</p>
        <LienExplication
          onClick={() => {
            setExplication(true)
          }}
        />
      </header>
      {erreur && (
        <div className={styles.erreur}>
          <Text variant="corps">Ton Codex n’a pas pu se charger.</Text>
          <Button
            kind="secondaire"
            onClick={() => {
              void reessayer()
            }}
          >
            Réessayer
          </Button>
        </div>
      )}
      {codex && (
        <>
          <CompteTotal totaux={codex.totaux} />
          {codex.totaux.portes + codex.totaux.scannes === 0 && (
            <p className={styles.premier}>
              Scanne ton premier Fragment, le tien ou celui d’un autre Porteur : il entrera dans ton
              Codex.
            </p>
          )}
          <FiltresCollections collections={codex.collections} choisie={choisie} choisir={choisir} />
          {codex.collections
            .filter((c) => choisie === null || c.nom === choisie)
            .map((c) => (
              <SectionCollection key={c.nom} collection={c} />
            ))}
        </>
      )}
      {explication && (
        <CommentCaMarche
          onFermer={() => {
            setExplication(false)
          }}
        />
      )}
    </section>
  )
}
