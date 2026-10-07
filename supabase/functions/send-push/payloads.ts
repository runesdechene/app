// Le texte et l'écran d'un push, par type de notification — ceux de la cloche de la V2
// (`_notification_v2`, migration 421 ; phrases de apps/web-v2/src/features/notifications/lib/phrase.ts).
// L'URL est un chemin d'appli sans base (« /accueil/lieu/<id> ») : le service worker de la V2 la
// pose sous sa base (/v2/, puis /explore/ après la bascule — spec 2026-10-07-v2-bascule §3).
// Les noms (`actorName`, `placeTitle`) sont complétés par index.ts quand la notification n'a que
// les identifiants.

export interface PushPayload {
  title: string
  body: string
  url: string
}

type Data = Record<string, unknown>

const texte = (v: unknown, repli = ''): string =>
  v === undefined || v === null || v === '' ? repli : String(v)

const ficheDuLieu = (data: Data): string => {
  const id = texte(data.placeId)
  return id ? `/accueil/lieu/${id}` : '/accueil'
}

export function formatPayload(type: string, data: Data): PushPayload | null {
  const qui = texte(data.actorName, 'Quelqu’un')
  const lieu = texte(data.placeTitle, 'un de tes lieux')
  const nombre = Number(data.viewCount ?? data.explorerCount ?? data.likeCount ?? data.visitorsToday ?? 0)
  const surLeLieu = (title: string, body: string): PushPayload => ({
    title,
    body,
    url: ficheDuLieu(data),
  })

  switch (type) {
    case 'new_comment':
      return surLeLieu(`${qui} a commenté ${lieu}`, 'Va voir ce qu’on en dit.')
    case 'comment_reply':
      return surLeLieu(`${qui} t’a répondu`, `Sur ${lieu}.`)
    case 'new_carnet':
      return surLeLieu(`${qui} a écrit sur ${lieu}`, 'Un nouveau mot dans le carnet.')
    case 'coeur_mot':
      return surLeLieu(`${qui} a aimé ton mot`, `Sur ${lieu}.`)
    case 'like_carnet':
      return surLeLieu(`${qui} a aimé ton récit`, `Celui de ${lieu}.`)
    case 'like_contribution':
      return surLeLieu(`${qui} a envoyé des cœurs à ${lieu}`, 'Ton lieu plaît.')
    case 'description_edited':
      return surLeLieu(`${qui} a enrichi le récit de ${lieu}`, 'Va lire ce qui a changé.')
    case 'lieu_modifie':
      return surLeLieu(`${qui} a modifié ${lieu}`, 'Va voir ce qui a changé.')
    case 'new_photo':
      return surLeLieu(`${qui} a ajouté des photos à ${lieu}`, 'De nouvelles images.')
    case 'place_position_edited':
      return surLeLieu(`${qui} a corrigé la position de ${lieu}`, 'Le lieu a bougé sur la carte.')
    case 'exploration':
      return surLeLieu(
        nombre === 1 ? `1 Explorateur a foulé ${lieu}` : `${nombre} Explorateurs ont foulé ${lieu}`,
        'Aujourd’hui.',
      )
    case 'milestone_exploration':
      return surLeLieu(`${nombre} Explorateurs ont foulé ${lieu}`, 'Un cap pour ton lieu.')
    case 'milestone_vues':
      return surLeLieu(`Ta fiche de ${lieu} a été vue ${nombre} fois`, 'Un cap pour ton lieu.')
    case 'milestone_likes':
      return surLeLieu(`${lieu} a reçu ${nombre} cœurs`, 'Un cap pour ton lieu.')

    case 'mention':
      return {
        title: `${qui} t’a mentionné`,
        body: texte(data.extrait, 'Dans le Registre.').slice(0, 120),
        url: '/messages',
      }
    case 'salut': {
      const evenement = texte(data.evenement).split(':')[0]
      if (evenement === 'message') {
        return { title: `${qui} a aimé ton message`, body: 'Dans le Registre.', url: '/messages' }
      }
      return data.placeId
        ? surLeLieu(`${qui} t’a salué`, `Pour ${lieu}.`)
        : { title: `${qui} t’a salué`, body: 'Sur les chemins.', url: '/accueil' }
    }

    case 'demande_compagnie': {
      const id = texte(data.compagnieId)
      return {
        title: `${qui} demande à rejoindre ${texte(data.compagnieNom, 'ta Compagnie')}`,
        body: 'Accepte ou refuse sa demande.',
        url: id ? `/accueil/compagnie/${id}/gerer` : '/accueil',
      }
    }
    case 'demande_acceptee': {
      const id = texte(data.compagnieId)
      return {
        title: `Bienvenue dans ${texte(data.compagnieNom, 'ta Compagnie')}`,
        body: 'Ta demande est acceptée.',
        url: id ? `/accueil/compagnie/${id}` : '/accueil',
      }
    }

    case 'mise_a_jour':
      return {
        title: 'Nouveautés d’Explore',
        body: texte(data.titre, 'Une mise à jour est arrivée.'),
        url: '/accueil/nouveautes',
      }

    default:
      return null
  }
}
