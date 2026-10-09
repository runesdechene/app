/**
 * QUOI     — la liste des cinq onglets et les règles qui répondent à un toucher.
 * POURQUOI — conventions mobiles (spec socle §4bis) : chaque onglet se souvient de sa dernière
 *            adresse ; toucher l'onglet actif remonte à sa racine, puis en haut de page.
 * ATTENTION — l'onglet se lit dans le PREMIER segment de l'URL (/carte/compte → carte). Toute
 *            future adresse d'un écran doit donc commencer par son onglet.
 */
export type TabId = 'accueil' | 'carte' | 'messages' | 'compagnies' | 'compte'

export const TABS = [
  { id: 'accueil', label: 'Explore', path: '/accueil' }, // « Explore » (Uriel, 08/10) ; l'adresse reste /accueil
  { id: 'carte', label: 'Carte', path: '/carte' },
  { id: 'messages', label: 'Messages', path: '/messages' },
  { id: 'compagnies', label: 'Compagnies', path: '/compagnies' },
  { id: 'compte', label: 'Compte', path: '/compte' },
] as const satisfies readonly { id: TabId; label: string; path: `/${TabId}` }[]

const TAB_IDS: ReadonlySet<string> = new Set(TABS.map((t) => t.id))

export function isTabId(value: string | undefined): value is TabId {
  return value !== undefined && TAB_IDS.has(value)
}

export function tabOf(pathname: string): TabId | null {
  const first = pathname.split('/')[1]
  return isTabId(first) ? first : null
}

// Une adresse qu'un onglet retient. Pas un passage : la feuille « Ajouter » et le parcours d'ajout
// se ferment et ne se rouvrent jamais d'eux-mêmes (Uriel, 30/09 : quitter l'ajout puis toucher
// l'Accueil rouvrait l'ajout).
export function aRetenir(pathname: string): boolean {
  return !/^\/[^/]+\/ajouter(\/|$)/.test(pathname)
}

export type TabPressAction = { kind: 'navigate'; to: string } | { kind: 'scrollTop' }

export function resolveTabPress(args: {
  active: TabId | null
  pressed: TabId
  pathname: string
  memory: Partial<Record<TabId, string>>
}): TabPressAction {
  const root = `/${args.pressed}`
  if (args.pressed !== args.active) {
    return { kind: 'navigate', to: args.memory[args.pressed] ?? root }
  }
  return args.pathname === root ? { kind: 'scrollTop' } : { kind: 'navigate', to: root }
}
