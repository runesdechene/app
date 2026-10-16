/**
 * QUOI     — une photo (ou une vidéo) d'une contribution, qui s'ouvre en grand dans un onglet, avec ses
 *            quatre canaux (Communauté, Mur, Fiche produit, Média), son produit Shopify, son téléchargement
 *            et sa suppression.
 * POURQUOI — Communauté et Fiche produit n'existent que sur un produit relié ; « Média » est l'accord de
 *            diffusion de la contribution, qu'on lit ici sans le changer. Une écriture à la fois : les
 *            pastilles sont désactivées pendant qu'elle part et que la liste se relit, et son erreur reste sous la photo.
 */
import { useIsFetching } from '@tanstack/react-query'
import { useState } from 'react'
import {
  delierProduit, mettreSurLaFiche, montrerAuMur, montrerDansCommunaute, relierProduit, supprimerPhoto,
  type Contribution, type PhotoDeContribution as Photo,
} from '../api/contributions'
import { useEcritureDePhoto } from '../hooks/useContributions'
import { adresseDeTelechargement, estUneVideo, nomDeFichier, texteAlternatif } from '../lib/contribution'
import { ChoixDuProduit } from './ChoixDuProduit'
import styles from './Photos.module.css'

/** Un canal de diffusion, en pastille : pleine quand la photo y est, en contour sinon. */
function Canal({ libelle, actif, desactive, onBascule }: {
  libelle: string; actif: boolean; desactive: boolean; onBascule?: () => void
}) {
  return (
    <button type="button" className={styles.canal} aria-pressed={actif} disabled={desactive} onClick={onBascule}>
      {libelle}
    </button>
  )
}

export function PhotoDeContribution({ contribution, photo, rang }: { contribution: Contribution; photo: Photo; rang: number }) {
  const ecriture = useEcritureDePhoto()
  const [choixDuProduit, setChoixDuProduit] = useState(false)
  const [confirme, setConfirme] = useState(false)
  const sansProduit = photo.produit_id === null
  // Tant que les contributions se relisent, la photo affichée est périmée : une écriture de plus la referait.
  const relecture = useIsFetching({ queryKey: ['hub-contributions'] }) > 0
  const occupe = ecriture.isPending || relecture

  function ecrire(action: () => Promise<void>, apres: () => void = () => undefined) {
    ecriture.reset()
    ecriture.mutate(action, { onSuccess: apres })
  }

  return (
    <figure className={styles.photo}>
      <a href={photo.url} target="_blank" rel="noreferrer">
        {estUneVideo(photo.url)
          ? <video src={photo.url} muted preload="metadata" />
          : <img src={photo.url} alt={texteAlternatif(contribution.nom, contribution.hauteur, photo.taille ?? contribution.taille)} loading="lazy" />}
      </a>
      {photo.taille && <figcaption className={styles.petit}>{photo.taille === 'none' ? 'Aucun produit' : `Taille ${photo.taille}`}</figcaption>}

      <div className={styles.canaux}>
        <Canal libelle="Communauté" actif={photo.communaute} desactive={sansProduit || occupe}
          onBascule={() => { ecrire(() => montrerDansCommunaute(photo.id, !photo.communaute)) }} />
        <Canal libelle="Mur" actif={photo.mur} desactive={occupe}
          onBascule={() => { ecrire(() => montrerAuMur(photo.id, !photo.mur)) }} />
        <Canal libelle="Fiche produit" actif={photo.media !== null} desactive={sansProduit || occupe}
          onBascule={() => { ecrire(() => mettreSurLaFiche(contribution, photo, photo.media === null)) }} />
        <Canal libelle="Média" actif={contribution.diffusion} desactive />
      </div>
      {sansProduit && <p className={styles.petit}>Communauté et fiche produit : relie d’abord un produit.</p>}

      {photo.produit_id !== null ? (
        <p className={styles.petit}>
          <span>{`Relié à ${photo.produit_titre ?? photo.produit_handle ?? photo.produit_id}`}</span>{' '}
          <button type="button" className={styles.lien} disabled={occupe} onClick={() => { ecrire(() => delierProduit(photo)) }}>Retirer</button>
        </p>
      ) : choixDuProduit ? (
        <ChoixDuProduit onChoix={(produit) => { ecrire(() => relierProduit(photo.id, produit), () => { setChoixDuProduit(false) }) }}
          onAnnule={() => { setChoixDuProduit(false) }} />
      ) : (
        <button type="button" className={styles.lien} disabled={occupe} onClick={() => { setChoixDuProduit(true) }}>Relier à un produit</button>
      )}

      <div className={styles.petit}>
        <a className={styles.lien} href={adresseDeTelechargement(photo.url, nomDeFichier(contribution.nom, contribution.instagram, rang, photo.url))}>Télécharger</a>
        {confirme ? (
          <>
            <span>Supprimer cette photo ?</span>
            <button type="button" className={styles.lien} disabled={occupe} onClick={() => { ecrire(() => supprimerPhoto(photo), () => { setConfirme(false) }) }}>Confirmer</button>
            <button type="button" className={styles.lien} onClick={() => { setConfirme(false) }}>Annuler</button>
          </>
        ) : (
          <button type="button" className={styles.lien} disabled={occupe} onClick={() => { setConfirme(true) }}>Supprimer la photo</button>
        )}
      </div>
      {ecriture.error && <p role="alert" className={styles.erreur}>{ecriture.error.message}</p>}
    </figure>
  )
}
