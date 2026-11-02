/**
 * QUOI     — la fiche d'un Fragment (maquettes C et D, 02/11) : l'illustration, le nom, la
 *            collection, l'artiste, son statut (scanné N fois, ou Porteur n° N et son rang) ;
 *            « En bref » et « Le mot de l'artiste » pour tous ; au Porteur, ses cadeaux ; aux autres,
 *            ce qu'on gagne en le portant et « Acquérir ce Fragment ». Puis ses anecdotes : après un
 *            scan, la nouvelle et « Creuser encore » ; depuis le Codex, « Scanner ce motif ».
 * POURQUOI — spec du Codex : le scan attire, l'achat ouvre tout. L'histoire entière (à lire ou à
 *            écouter) reste à l'acheteur ; la préhistoire et le mot de l'artiste, à tous.
 * ATTENTION — le skin du profil est le signe (`set_my_signe`) : la coquille passe `equiper`, une zone
 *            n'en importe pas une autre. Sans compte (`connecte` faux), rien de personnel.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { libelleEdition } from '@/shared/lib/edition'
import { aLaTaille } from '@/shared/lib/image'
import { rangDuNumero } from '@/shared/lib/rang'
import { Button } from '@/shared/ui/Button'
import { Insigne } from '@/shared/ui/Insigne'
import { Text } from '@/shared/ui/Text'
import type { MonFragment } from '../api/lireMonFragment'
import type { Recit } from '../api/lireRecit'
import { useAnecdotes } from '../hooks/useAnecdotes'
import { useMonFragment } from '../hooks/useMonFragment'
import { usePorterTitre } from '../hooks/usePorterTitre'
import { useRecit } from '../hooks/useRecit'
import { Anecdotes } from './Anecdotes'
import { DecouverteFragment } from './DecouverteFragment'
import { MotDeLArtiste } from './MotDeLArtiste'
import styles from './FicheFragment.module.css'

// Les dessins des cadeaux : livre (son histoire), buste (le skin), dièse (le numéro).
const ICONES = {
  histoire:
    'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  skin: 'M12 3a5 5 0 1 0 0 10a5 5 0 1 0 0-10ZM20 21a8 8 0 0 0-16 0',
  numero: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
  titre:
    'M15.48 12.89 17 21.42a.5.5 0 0 1-.81.47l-3.58-2.69a1 1 0 0 0-1.2 0l-3.59 2.69a.5.5 0 0 1-.81-.47l1.51-8.53M12 2a6 6 0 1 0 0 12a6 6 0 1 0 0-12Z',
} as const

// Trois titres portés au plus (set_my_displayed_titles).
const TITRES_PORTES_MAX = 3

function TitreDuPorteur({
  titre,
  portes,
  porter,
  enCours,
}: {
  titre: { id: number; nom: string }
  portes: number[]
  porter: (ids: number[]) => void
  enCours: boolean
}) {
  const [trop, setTrop] = useState(false)
  const porte = portes.includes(titre.id)
  return (
    <li className={styles.cadeau}>
      <Pastille icone="titre" />
      <span className={styles.texteCadeau}>
        <strong>Le titre « {titre.nom} »</strong>
        <span>À porter sous ton nom</span>
        {trop && (
          <span role="alert" className={styles.alerte}>
            Tu portes déjà trois titres : retire-en un depuis ton profil.
          </span>
        )}
      </span>
      {porte ? (
        <span className={styles.equipe}>Porté</span>
      ) : (
        <Button
          kind="secondaire"
          disabled={enCours}
          onClick={() => {
            if (portes.length >= TITRES_PORTES_MAX) setTrop(true)
            else porter([...portes, titre.id])
          }}
        >
          Porter
        </Button>
      )}
    </li>
  )
}

function Pastille({ icone }: { icone: keyof typeof ICONES }) {
  return (
    <span className={styles.pastille} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d={ICONES[icone]} />
      </svg>
    </span>
  )
}

function Statut({ moi }: { moi: MonFragment }) {
  if (moi.etat === 'porte' && moi.numero !== null) {
    const rang = rangDuNumero(moi.numero)
    return (
      <p className={styles.porteur} data-rang={rang}>
        <Insigne rarete={rang} />
        Porteur n° {moi.numero}
      </p>
    )
  }
  if (moi.etat === 'scanne') {
    return <p className={styles.scanne}>Scanné {moi.scans} fois</p>
  }
  return null
}

function phraseDuRang(numero: number, porteurs: number, nom: string): string {
  const sur = `sur ${String(porteurs)} Porteurs de ${nom}`
  if (numero <= 10) return `Parmi les 10 premiers · ${sur}`
  if (numero <= 50) return `Parmi les 50 premiers · ${sur}`
  return sur.charAt(0).toUpperCase() + sur.slice(1)
}

function Cadeaux({
  recit,
  moi,
  equiper,
  porter,
  enCours,
}: {
  recit: Recit
  moi: MonFragment
  equiper: (id: number) => Promise<void>
  porter: (ids: number[]) => void
  enCours: boolean
}) {
  return (
    <section className={styles.cadeaux} aria-labelledby="cadeaux">
      <h2 id="cadeaux" className={styles.titreSection}>
        Tes cadeaux
      </h2>
      <ul className={styles.liste}>
        <li>
          <Link className={styles.cadeau} to="histoire" relative="path">
            <Pastille icone="histoire" />
            <span className={styles.texteCadeau}>
              <strong>Son histoire</strong>
              <span>L’histoire du motif, à lire ou à écouter</span>
            </span>
          </Link>
        </li>
        <li className={styles.cadeau}>
          <Pastille icone="skin" />
          <span className={styles.texteCadeau}>
            <strong>Le skin de profil {recit.nom}</strong>
            <span>Ton portrait sous son signe</span>
          </span>
          {moi.signe ? (
            <span className={styles.equipe}>Équipé</span>
          ) : (
            <Button kind="secondaire" onClick={() => void equiper(recit.id)}>
              Équiper
            </Button>
          )}
        </li>
        {moi.titre && (
          <TitreDuPorteur
            titre={moi.titre}
            portes={moi.titresPortes}
            porter={porter}
            enCours={enCours}
          />
        )}
        {moi.numero !== null && (
          <li className={styles.cadeau}>
            <Insigne rarete={rangDuNumero(moi.numero)} />
            <span className={styles.texteCadeau}>
              <strong>Porteur n° {moi.numero}</strong>
              <span>{phraseDuRang(moi.numero, moi.porteurs, recit.nom)}</span>
            </span>
          </li>
        )}
      </ul>
    </section>
  )
}

function CeQueTuGagnes({ recit, moi }: { recit: Recit; moi: MonFragment | null | undefined }) {
  return (
    <section className={styles.gagner} aria-labelledby="gagner">
      <h2 id="gagner" className={styles.titreSection}>
        En le portant, tu gagnes
      </h2>
      <p className={styles.aide}>Tout s’ouvre dès que le Fragment est relié à ton compte.</p>
      <ul className={styles.liste}>
        <li className={styles.cadeau} data-ferme>
          <Pastille icone="histoire" />
          <span className={styles.texteCadeau}>
            <strong>Son histoire</strong>
            <span>L’histoire du motif, à lire ou à écouter</span>
          </span>
        </li>
        <li className={styles.cadeau} data-ferme>
          <Pastille icone="skin" />
          <span className={styles.texteCadeau}>
            <strong>Le skin de profil {recit.nom}</strong>
            <span>Ton portrait sous son signe</span>
          </span>
        </li>
        <li className={styles.cadeau} data-ferme>
          <Pastille icone="numero" />
          <span className={styles.texteCadeau}>
            <strong>Ton numéro de Porteur</strong>
            <span>
              {moi
                ? `Tu serais le ${String(moi.porteurs + 1)}ᵉ Porteur de ${recit.nom}`
                : 'Plus tu le relies tôt, plus il est petit'}
            </span>
          </span>
        </li>
      </ul>
      {recit.boutique && <Button href={recit.boutique}>Acquérir ce Fragment</Button>}
      <p className={styles.aide}>
        Déjà Porteur ? Ton e-mail de commande suffit à le relier à ton compte.
      </p>
    </section>
  )
}

export function FicheFragment({
  id,
  connecte,
  equiper,
  scan = null,
}: {
  id: number
  connecte: boolean
  equiper: (id: number) => Promise<void>
  scan?: number | null // l'heure du scan qui a ouvert la fiche ; null depuis le Codex
}) {
  const { recit, erreur, reessayer } = useRecit(id)
  const { moi } = useMonFragment(id, connecte)
  const anecdotes = useAnecdotes(id, connecte ? scan : null)
  const titre = usePorterTitre(id)
  const [decouverteVue, setDecouverteVue] = useState(false)

  if (erreur) {
    return (
      <div className={styles.fiche}>
        <Text variant="corps">Ce Fragment n’a pas pu se charger.</Text>
        <Button
          kind="secondaire"
          onClick={() => {
            void reessayer()
          }}
        >
          Réessayer
        </Button>
      </div>
    )
  }
  if (recit === undefined) return null
  if (recit === null) {
    return (
      <div className={styles.fiche}>
        <Text variant="corps">Ce Fragment n’est plus visible.</Text>
      </div>
    )
  }

  const edition = libelleEdition(recit.edition, recit.editionPrecision)
  return (
    <article className={styles.fiche}>
      {anecdotes.tirage?.premiereDecouverte && !decouverteVue && (
        <DecouverteFragment
          nom={recit.nom}
          illustration={recit.illustration}
          collection={anecdotes.tirage.collection}
          anecdote={anecdotes.tirage.anecdote}
          boutique={recit.boutique}
          creuser={anecdotes.creuser}
          fermer={() => {
            setDecouverteVue(true)
          }}
        />
      )}
      <header className={styles.tete}>
        {recit.illustration && (
          <span className={styles.illustration} data-porte={moi?.etat === 'porte' || undefined}>
            <img src={aLaTaille(recit.illustration, 186)} alt={`L’illustration de ${recit.nom}`} />
          </span>
        )}
        <h1 className={styles.nom}>{recit.nom}</h1>
        {recit.heritage && <p className={styles.collection}>de la collection {recit.heritage}</p>}
        {recit.artiste && <p className={styles.artiste}>Dessiné par {recit.artiste}</p>}
        {edition && <p className={styles.edition}>{edition}</p>}
        {moi && <Statut moi={moi} />}
      </header>

      {recit.resume && (
        <section className={styles.bref} aria-labelledby="en-bref">
          <h2 id="en-bref" className={styles.titreSection}>
            En bref
          </h2>
          <p className={styles.resume}>{recit.resume}</p>
          {moi?.etat === 'porte' ? (
            <Link className={styles.lire} to="histoire" relative="path">
              Lire toute son histoire, ou l’écouter →
            </Link>
          ) : (
            <p className={styles.reserve}>
              La suite, en entier et racontée, est réservée à ceux qui le portent.
            </p>
          )}
        </section>
      )}

      {recit.motArtiste && (
        <MotDeLArtiste mot={recit.motArtiste} artiste={recit.artiste} photo={recit.artistePhoto} />
      )}

      {moi?.etat === 'porte' && (
        <Cadeaux
          recit={recit}
          moi={moi}
          equiper={equiper}
          porter={titre.porter}
          enCours={titre.enCours}
        />
      )}
      {moi && (
        <Anecdotes
          anecdotes={moi.anecdotes}
          restantes={moi.restantes}
          raresRestantes={moi.raresRestantes}
          tirage={anecdotes.tirage}
          creuser={anecdotes.creuser}
          enCours={anecdotes.enCours}
          plusDEnergie={anecdotes.plusDEnergie}
        />
      )}
      {moi?.etat !== 'porte' && <CeQueTuGagnes recit={recit} moi={moi} />}
    </article>
  )
}
