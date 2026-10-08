/**
 * QUOI     — la phrase d'une notification, en morceaux : qui (en gras), le lieu (en ocre), le reste.
 * POURQUOI — une seule table des tournures, lisible d'un coup d'œil ; l'écran ne fait qu'afficher.
 *            On tutoie, comme partout dans la V2.
 */
import type { Notification } from '../api/lireNotifications'

export type Morceau = { texte: string; sorte: 'qui' | 'lieu' | 'texte' }

const t = (texte: string): Morceau => ({ texte, sorte: 'texte' })

export function phraseDe(n: Notification): Morceau[] {
  const qui: Morceau = { texte: n.qui?.nom ?? 'Quelqu’un', sorte: 'qui' }
  const lieu: Morceau = { texte: n.lieu?.nom ?? 'un lieu disparu', sorte: 'lieu' }
  const combien = String(n.nombre ?? 0)

  switch (n.type) {
    case 'like_contribution':
      return [qui, t(' a envoyé des cœurs à '), lieu]
    case 'like_carnet':
      return [qui, t(' a aimé ton récit de '), lieu]
    case 'new_carnet':
      return [qui, t(' a écrit sur '), lieu]
    case 'description_edited':
      return [qui, t(' a enrichi le récit de '), lieu]
    case 'new_photo':
      return [qui, t(' a ajouté des photos à '), lieu]
    case 'new_comment':
      return [qui, t(' a commenté '), lieu]
    case 'coeur_mot':
      return [qui, t(' a aimé ton mot sur '), lieu]
    case 'comment_reply':
      return [qui, t(' t’a répondu sur '), lieu]
    case 'place_position_edited':
      return [qui, t(' a corrigé la position de '), lieu]
    case 'exploration':
      return n.nombre === 1
        ? [t('1 Explorateur a foulé '), lieu, t(' aujourd’hui')]
        : [t(`${combien} Explorateurs ont foulé `), lieu, t(' aujourd’hui')]
    case 'visite':
      return [qui, t(' a visité '), lieu]
    case 'revendication_reprise':
      return [qui, t(' a revendiqué '), lieu, t(', que tu tenais')]
    case 'milestone_exploration':
      return [t(`${combien} Explorateurs ont foulé `), lieu]
    case 'milestone_vues':
      return [t('Ta fiche de '), lieu, t(` a été vue ${combien} fois`)]
    case 'milestone_likes':
      return [lieu, t(` a reçu ${combien} cœurs`)]
    case 'demande_compagnie':
      return [
        qui,
        t(' demande à rejoindre '),
        { texte: n.compagnie?.nom ?? 'ta Compagnie', sorte: 'lieu' },
      ]
    case 'demande_acceptee':
      return [
        t('Ta demande pour '),
        { texte: n.compagnie?.nom ?? 'une Compagnie', sorte: 'lieu' },
        t(' est acceptée'),
      ]
    case 'nouveau_membre':
      return [
        qui,
        t(' a rejoint '),
        { texte: n.compagnie?.nom ?? 'ta Compagnie', sorte: 'lieu' },
      ]
    case 'mention':
      return [qui, t(` t’a mentionné dans le Registre : « ${n.extrait ?? ''} »`)]
    case 'mise_a_jour':
      return [
        { texte: 'Nouveautés d’Explore', sorte: 'qui' },
        t(' : '),
        { texte: n.extrait ?? '', sorte: 'lieu' },
      ]
    case 'salut':
      if (n.evenement === 'visite') return [qui, t(' a salué ta visite de '), lieu]
      if (n.evenement === 'ajout') return [qui, t(' a salué ton ajout de '), lieu]
      if (n.evenement === 'message') return [qui, t(' a aimé ton message')]
      if (n.evenement === 'connexion') return [qui, t(' a salué ton passage')]
      if (n.evenement === 'revendication') return [qui, t(' a salué ta revendication')]
      if (n.evenement === 'enrichi') return [qui, t(' a salué ton récit')]
      if (n.evenement === 'modifie') return [qui, t(' a salué ta modification')]
      if (n.evenement === 'fondation') return [qui, t(' a salué ta nouvelle Compagnie')]
      if (n.evenement === 'adhesion') return [qui, t(' a salué ton entrée dans une Compagnie')]
      return [qui, t(' a salué ton arrivée')]
    default:
      return [qui, t(' a laissé une trace sur '), lieu]
  }
}
