/**
 * QUOI     — la lecture d'un lieu en carte (`LieuDeCarte`), tel que `_carte_lieu` le rend (migration
 *            358) : l'Accueil (« Ajoutés récemment ») et la fiche d'une Compagnie (« Leurs lieux »).
 * POURQUOI — une seule lecture pour une seule forme : chaque champ est prouvé.
 */
import { chaine, nombre, objet, ouNull } from '@/shared/lib/lire'
import type { LieuDeCarte } from '@/shared/ui/LieuCarte'

export function lireLieuDeCarte(v: unknown): LieuDeCarte {
  const l = objet(v)
  return {
    id: chaine(l.id),
    nom: chaine(l.nom),
    imageUrl: ouNull(chaine)(l.imageUrl),
    latitude: ouNull(nombre)(l.latitude),
    longitude: ouNull(nombre)(l.longitude),
    categorie: ouNull((c) => ({ icone: chaine(objet(c).icone) }))(l.categorie),
    auteur: ouNull((a) => ({
      nom: chaine(objet(a).nom),
      avatarUrl: ouNull(chaine)(objet(a).avatarUrl),
    }))(l.auteur),
  }
}
