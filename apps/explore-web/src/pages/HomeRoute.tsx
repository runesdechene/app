import { MainShell } from './MainShell'

/**
 * Route /accueil — rend MainShell en mode "home".
 * Mobile : HomePage seule. Desktop : split-view permanent (panel + carte).
 */
export default function HomeRoute() {
  return <MainShell view="home" />
}
