// Le questionnaire « Dis-nous qui tu es » (maquette 746:2463) : ses questions et leurs réponses, mot pour mot.
// Partagé par la page publique du Hub et la fonction qui enregistre ; la base refuse les mêmes clés (mig 555).

export const QUESTIONS = {
  epoques: {
    titre: 'Quelle collection te plaît ou te plairait ?',
    aide: 'Deux au plus.',
    max: 2,
    libre: { reponse: 'autre', champ: 'epoque_autre', invite: 'Laquelle ?' },
    // Des noms de collections, l'ordre d'Uriel (24/10) ; les clés ne changent pas avec les libellés (mig 557 à 562).
    reponses: [
      ['moyen_age', 'Le Moyen Âge'], ['grece', 'La Grèce antique'], ['rome', 'Rome, d’Orient et d’Occident'],
      ['celtes', 'Les Celtes et les Gaulois'], ['scandinavie', 'Les Vikings et le Grand Nord'], ['slave', 'Les légendes slaves'],
      ['napoleon', 'L’épopée napoléonienne'], ['totems', 'Les totems animaliers'], ['amazigh', 'La culture amazighe'],
      ['egypte', 'L’Égypte antique'], ['autre', 'Une autre idée'],
    ],
  },
  decouverte: {
    titre: 'Comment as-tu découvert Runes de Chêne ?',
    aide: null,
    max: null,
    libre: { reponse: 'autrement', champ: 'decouverte_autre', invite: 'Comment ?' },
    reponses: [
      ['stand', 'Sur un stand, en festival'], ['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['ami', 'Un ami'],
      ['flyer', 'Un flyer'], ['recherche', 'Une recherche sur internet'], ['autrement', 'Autrement'],
    ],
  },
  amene: {
    titre: 'Qu’est-ce qui t’amène ?',
    aide: null,
    max: null,
    libre: null,
    reponses: [
      ['histoire', 'Porter l’Histoire'], ['lieux', 'Explorer des lieux'], ['cadeau', 'Offrir un cadeau'],
      ['communaute', 'La communauté'], ['curiosite', 'La curiosité'],
    ],
  },
  plait: {
    titre: 'Qu’est-ce qui te plaît le plus chez nous ?',
    aide: 'Plusieurs réponses possibles.',
    max: null,
    libre: null,
    reponses: [
      ['illustrations', 'Les illustrations'], ['histoires', 'Les histoires derrière les Fragments'],
      ['qualite', 'La qualité des vêtements'], ['ethique', 'L’éthique : coton bio, Bretagne, sans IA'],
      ['carte', 'La carte des lieux'], ['scan', 'Pouvoir scanner son t-shirt'], ['communaute', 'La communauté'],
      ['equipe', 'L’équipe'],
    ],
  },
} as const

export type Question = keyof typeof QUESTIONS

export type Reponses = {
  epoques: string[]
  /** Ce que précisent « Une autre » époque et « Autrement » (`libre` de leur question), en clair. */
  epoque_autre: string | null
  decouverte_autre: string | null
  decouverte: string[]
  amene: string[]
  plait: string[]
  attente: string | null
  /** « Un petit mot pour l'équipe ou sur notre mission ? » */
  mot: string | null
  departement: string | null
  anniv_jour: number | null
  anniv_mois: number | null
}

export const ATTENTE_MAX = 1000
export const LIBRE_MAX = 60

const estUneListe = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

/** Les réponses reçues si elles sont valables, sinon `null` : rien d'inconnu, rien de trop long, une vraie date. */
export function validerReponses(recu: unknown): Reponses | null {
  if (typeof recu !== 'object' || recu === null) return null
  const r = recu as Record<string, unknown>
  const listes = {} as Pick<Reponses, Question>
  for (const q of Object.keys(QUESTIONS) as Question[]) {
    const valeur = r[q] ?? []
    if (!estUneListe(valeur)) return null
    const permises = QUESTIONS[q].reponses.map(([cle]) => cle as string)
    if (!valeur.every((v) => permises.includes(v))) return null
    const max = QUESTIONS[q].max
    if (max !== null && valeur.length > max) return null
    listes[q] = [...new Set(valeur)]
  }
  const texte = (v: unknown, limite: number) => (typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, limite) : null)
  const jour = r.anniv_jour ?? null
  const mois = r.anniv_mois ?? null
  if ((jour === null) !== (mois === null)) return null
  if (jour !== null && mois !== null) {
    if (typeof jour !== 'number' || typeof mois !== 'number') return null
    // Une année bissextile : le 29 février existe, le 31 février non.
    const date = new Date(Date.UTC(2024, mois - 1, jour))
    if (date.getUTCMonth() !== mois - 1 || date.getUTCDate() !== jour) return null
  }
  if (typeof r.attente === 'string' && r.attente.trim().length > ATTENTE_MAX) return null
  if (typeof r.mot === 'string' && r.mot.trim().length > ATTENTE_MAX) return null
  return {
    ...listes,
    // Le texte d'une réponse « autre » ne vaut qu'avec sa case.
    epoque_autre: listes.epoques.includes('autre') ? texte(r.epoque_autre, LIBRE_MAX) : null,
    decouverte_autre: listes.decouverte.includes('autrement') ? texte(r.decouverte_autre, LIBRE_MAX) : null,
    attente: texte(r.attente, ATTENTE_MAX),
    mot: texte(r.mot, ATTENTE_MAX),
    departement: texte(r.departement, 60),
    anniv_jour: jour as number | null,
    anniv_mois: mois as number | null,
  }
}
