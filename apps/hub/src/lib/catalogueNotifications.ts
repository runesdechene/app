// apps/hub/src/lib/catalogueNotifications.ts
// Le catalogue des notifications pour l'écran « Notifications » du Hub. Ce qui part, sa catégorie
// et son texte viennent du code de send-push lui-même (la seule source de ce qui est envoyé) : le
// Hub n'ajoute que ce que le code ne dit pas, le déclencheur et qui la reçoit. Une sorte absente
// de send-push est silencieuse : aucun push ne part. Ce fichier tient lieu d'inventaire (l'ancien
// docs/v2/notifications.md est retiré) : une notification ajoutée s'y décrit dans le même commit.
import { CATEGORY_BY_TYPE, categoryOf, type Category } from '../../../../supabase/functions/send-push/categories'
import { formatPayload } from '../../../../supabase/functions/send-push/payloads'

export type { Category }

export interface SorteDeNotification {
  type: string
  nom: string
  quand: string
  pour: string
  categorie: Category
  exemple: { title: string; body: string } | null
}

// Le déclencheur et le destinataire de chaque sorte (inventaire du 08/10/2026, mig 464).
const DESCRIPTIONS: Record<string, { nom: string; quand: string; pour: string }> = {
  like_contribution: { nom: 'Cœurs sur un lieu', quand: 'quelqu’un envoie des cœurs à un lieu', pour: 'son auteur et ceux qui l’ont enrichi' },
  like_carnet: { nom: 'Récit aimé', quand: 'quelqu’un aime un récit', pour: 'son auteur' },
  new_carnet: { nom: 'Mot dans le carnet', quand: 'quelqu’un écrit dans le carnet d’un lieu', pour: 'l’auteur du lieu' },
  coeur_mot: { nom: 'Mot aimé', quand: 'quelqu’un aime un mot du carnet', pour: 'l’auteur du mot' },
  description_edited: { nom: 'Récit enrichi', quand: 'quelqu’un enrichit le récit d’un lieu', pour: 'l’auteur du lieu' },
  lieu_modifie: { nom: 'Lieu modifié', quand: 'quelqu’un modifie un lieu', pour: 'l’auteur du lieu' },
  new_photo: { nom: 'Nouvelles photos', quand: 'quelqu’un ajoute des photos à un lieu', pour: 'l’auteur du lieu' },
  place_position_edited: { nom: 'Position corrigée', quand: 'quelqu’un corrige la position d’un lieu', pour: 'l’auteur du lieu' },
  new_comment: { nom: 'Commentaire', quand: 'quelqu’un commente un lieu', pour: 'l’auteur du lieu' },
  comment_reply: { nom: 'Réponse', quand: 'quelqu’un répond à un commentaire', pour: 'l’auteur du commentaire' },
  mention: { nom: 'Mention', quand: 'quelqu’un mentionne un Explorateur dans le Registre', pour: 'la personne mentionnée' },
  salut: { nom: 'Salut', quand: 'quelqu’un salue (le premier salut seulement)', pour: 'la personne saluée' },
  demande_compagnie: { nom: 'Demande d’entrée', quand: 'quelqu’un demande à rejoindre une Compagnie privée', pour: 'son Chef et ses Officiers' },
  demande_acceptee: { nom: 'Demande acceptée', quand: 'une demande d’entrée est acceptée', pour: 'le demandeur' },
  mise_a_jour: { nom: 'Mise à jour de l’app', quand: 'une mise à jour est publiée depuis le Hub', pour: 'tout le monde' },
  visite: { nom: 'Visite d’un lieu', quand: 'un Explorateur visite un lieu pour la première fois', pour: 'l’auteur du lieu' },
  revendication_reprise: { nom: 'Lieu repris', quand: 'quelqu’un revendique un lieu déjà tenu', pour: 'celui qui le tenait' },
  nouveau_membre: { nom: 'Nouveau membre', quand: 'quelqu’un rejoint une Compagnie publique', pour: 'les autres membres' },
  enigme_du_jour: { nom: 'Énigme du jour', quand: 'chaque jour vers 12 h 30, si une énigme réveillée attend', pour: 'les abonnés absents depuis 18 h' },
  exploration: { nom: 'Visites du jour (V1)', quand: 'ancien récapitulatif des visites', pour: 'l’auteur du lieu' },
  milestone_exploration: { nom: 'Palier de visites', quand: 'un lieu atteint un palier de visites', pour: 'son auteur' },
  milestone_vues: { nom: 'Palier de vues', quand: 'une fiche atteint un palier de vues', pour: 'l’auteur du lieu' },
  milestone_likes: { nom: 'Palier de cœurs', quand: 'un lieu atteint un palier de cœurs', pour: 'son auteur' },
}

// De quoi remplir un exemple de texte, comme le ferait une vraie notification.
const EXEMPLE = {
  actorName: 'Kelpie',
  placeTitle: 'Belvédère d’Echazeaux',
  placeId: 'exemple',
  compagnieId: 'exemple',
  compagnieNom: 'Les Arpenteurs',
  titre: 'Les énigmes sur la carte',
  extrait: 'On se retrouve au col samedi ?',
  viewCount: 100,
  explorerCount: 10,
  likeCount: 50,
  visitorsToday: 3,
}

export function sorteDe(type: string): SorteDeNotification {
  const d = DESCRIPTIONS[type]
  const exemple = formatPayload(type, EXEMPLE)
  return {
    type,
    nom: d?.nom ?? type,
    quand: d?.quand ?? 'ancienne sorte, sans description',
    pour: d?.pour ?? '—',
    categorie: categoryOf(type),
    exemple: exemple ? { title: exemple.title, body: exemple.body } : null,
  }
}

/** Les sortes que le catalogue connaît : celles de send-push et celles qu'on a décrites. */
export function typesConnus(): string[] {
  return [...new Set([...Object.keys(CATEGORY_BY_TYPE), ...Object.keys(DESCRIPTIONS)])]
}

/** Toutes les sortes que send-push sait envoyer, plus celles vues en base (souvent silencieuses). */
export function catalogue(vues: string[]): SorteDeNotification[] {
  const types = new Set([...Object.keys(CATEGORY_BY_TYPE), ...vues])
  return [...types].map(sorteDe)
}
