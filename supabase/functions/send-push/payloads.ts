// Format des push payloads par type de notification.
// Wording sobre, ligne éditoriale Voie 3 (RdC 2026).

export interface PushPayload {
  title: string
  body: string
  url: string
}

type Data = Record<string, unknown>

const fr = (s: unknown, fallback = ''): string =>
  s === undefined || s === null ? fallback : String(s)

export function formatPayload(type: string, data: Data): PushPayload | null {
  switch (type) {
    case 'daily_enigma_ready':
      return {
        title: 'Ton énigme du jour',
        body:  'Le coffre t’attend.',
        url:   '/?enigma=daily',
      }

    case 'expedition_message': {
      const author        = fr(data.author_name, 'Un compagnon')
      const expeditionId  = fr(data.expedition_id)
      const expeditionName = fr(data.expedition_name, 'l’expédition')
      const preview       = fr(data.preview, '').slice(0, 80)
      return {
        title: `Message — ${expeditionName}`,
        body:  preview ? `${author} : ${preview}` : `${author} a écrit.`,
        url:   expeditionId ? `/?expedition=${expeditionId}` : '/',
      }
    }

    case 'place_taken_remote':
    case 'place_taken_back_gps':
    case 'place_reaffirmed': {
      const placeId   = fr(data.place_id)
      const placeName = fr(data.place_name, 'Un de tes lieux')
      return {
        title: type === 'place_reaffirmed'
          ? `${placeName} t’a échappé`
          : `${placeName} a changé de mains`,
        body:  'Reviens jeter un œil sur la carte.',
        url:   placeId ? `/?placeId=${placeId}` : '/',
      }
    }

    case 'level_up_imminent': {
      const xpDiff   = Number(data.xp_diff ?? 0)
      const nextLevel = Number(data.next_level ?? 0)
      return {
        title: `Plus que ${xpDiff} XP avant niveau ${nextLevel}`,
        body:  'Reviens jouer une énigme.',
        url:   '/?enigma=daily',
      }
    }

    case 'weekly_new_places_recap': {
      const count   = Number(data.count ?? 0)
      const samples = fr(data.sample_names_csv, '')
      return {
        title: `${count} nouveaux lieux cette semaine`,
        body:  samples ? `${samples}…` : 'Découvre la nouvelle carte.',
        url:   '/?layer=new',
      }
    }

    default:
      return null
  }
}
