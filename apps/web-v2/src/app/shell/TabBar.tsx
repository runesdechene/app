/**
 * QUOI     — la barre : Explore · Carte · Codex · Campement · Compte (maquette G, 02/11), icône
 *            gravée + libellé, lisière de forêt au-dessus ;
 *            l'onglet Compte montre l'avatar de l'Explorateur à la place d'une icône.
 * POURQUOI — un toucher est traduit par resolveTabPress (règles mobiles) puis appliqué ici.
 *            Sur PC, un fond clair glisse jusqu'à l'onglet actif : un seul élément, le curseur,
 *            déplacé en CSS selon son rang (`--rang`), comme la brique Segments.
 * ATTENTION — ce sont des <button>, pas des <a> : un onglet n'ouvre pas toujours son adresse
 *            (mémoire, double toucher ; sur téléphone, le portrait ouvre le menu du profil). aria-current marque l'onglet actif pour les lecteurs
 *            d'écran. Les icônes sont décoratives (aria-hidden) : le libellé porte le nom.
 */
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useExplorateur } from '@/features/compte/hooks/useExplorateur'
import { useMonIdentifiant } from '@/features/compte/hooks/useMonIdentifiant'
import accueilIcon from '@/assets/ui/onglet-accueil.png'
import campementIcon from '@/assets/ui/onglet-campement.svg'
import carteIcon from '@/assets/ui/onglet-carte.svg'
import codexIcon from '@/assets/ui/onglet-codex.svg'
import { Avatar } from '@/shared/ui/Avatar'
import { Text } from '@/shared/ui/Text'
import { useSurOrdinateur } from '@/shared/hooks/useSurOrdinateur'
import { ROUVERT_PAR_UN_ONGLET } from '../navigation/closeDetail'
import { resolveTabPress, tabOf, TABS, type TabId } from '../navigation/tabs'
import { useTabMemory } from '../navigation/useTabMemory'
import { MenuDuProfil } from './MenuDuProfil'
import styles from './TabBar.module.css'

// Les Compagnies se retirent peu à peu (Uriel, 01/11) : plus d'onglet ; leurs fiches restent
// ouvertes par lien (invitations, profils). Messages passe dans l'en-tête (Uriel, 02/11).
const DANS_LA_BARRE = ['accueil', 'carte', 'codex', 'campement', 'compte'] as const
type OngletDeLaBarre = (typeof DANS_LA_BARRE)[number]
const ONGLETS = TABS.filter((tab): tab is (typeof TABS)[number] & { id: OngletDeLaBarre } =>
  (DANS_LA_BARRE as readonly TabId[]).includes(tab.id),
)

// Sur PC, la barre n'a pas d'onglet Carte (la carte y est toujours là) : le curseur se range
// parmi les autres, et disparaît quand la Carte est active.
const ONGLETS_PC = ONGLETS.filter((tab) => tab.id !== 'carte')

const ICONS: Record<Exclude<OngletDeLaBarre, 'compte'>, string> = {
  accueil: accueilIcon,
  carte: carteIcon,
  codex: codexIcon,
  campement: campementIcon,
}

export function TabBar({
  onScrollTop,
  onToucher,
}: {
  onScrollTop: (tab: TabId) => void
  onToucher: () => void
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const memory = useTabMemory()
  const active = tabOf(pathname)
  const { profil } = useExplorateur(useMonIdentifiant())
  const rang = ONGLETS_PC.findIndex((tab) => tab.id === active)

  const [menuOuvert, setMenuOuvert] = useState(false)
  const surOrdinateur = useSurOrdinateur()

  function press(pressed: TabId) {
    onToucher()
    // Sur téléphone, le portrait ouvre le menu du profil (Uriel, 07/10), même quand Compte est déjà
    // l'onglet actif ; sur PC, il mène au profil, les autres entrées étant dans la barre.
    if (pressed === 'compte' && !surOrdinateur) {
      setMenuOuvert(true)
      return
    }
    const action = resolveTabPress({ active, pressed, pathname, memory })
    if (action.kind === 'navigate') void navigate(action.to, { state: ROUVERT_PAR_UN_ONGLET })
    else onScrollTop(pressed)
  }

  return (
    <nav className={styles.bar} aria-label="Navigation principale">
      {rang >= 0 && (
        <span className={styles.curseur} style={{ '--rang': String(rang) }} aria-hidden="true" />
      )}
      {ONGLETS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={styles.tab}
          data-onglet={tab.id}
          aria-current={tab.id === active ? 'page' : undefined}
          onClick={() => {
            press(tab.id)
          }}
        >
          {tab.id === 'compte' ? (
            <span className={styles.avatar} aria-hidden="true">
              <Avatar url={profil?.avatarUrl ?? null} nom={profil?.nom ?? ''} taille="mini" />
            </span>
          ) : (
            <span
              className={styles.icon}
              style={{ '--icone': `url(${ICONS[tab.id]})` }}
              aria-hidden="true"
            />
          )}
          <Text variant="libelle">{tab.label}</Text>
        </button>
      ))}
      {menuOuvert && (
        <MenuDuProfil
          onFermer={() => {
            setMenuOuvert(false)
          }}
        />
      )}
    </nav>
  )
}
