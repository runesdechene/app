/**
 * QUOI     — le lieu qu'un visiteur regardait quand il a choisi de rejoindre : on le retient,
 *            et la fin de l'onboarding l'ouvre sur la carte.
 * POURQUOI — il venait pour ce lieu ; l'onboarding traverse sept écrans et un e-mail, l'état de
 *            navigation ne survit pas à tout ça. La session du navigateur, si : elle s'efface
 *            avec l'onglet.
 * ATTENTION — le stockage peut être refusé (navigation privée) : alors on ne retient rien, et
 *            l'onboarding finit sur la carte, comme avant.
 */
const CLE = 'rdc:lieu-apres-entree'

export function retenirLieu(id: string) {
  try {
    sessionStorage.setItem(CLE, id)
  } catch {
    // Rien de retenu : la carte s'ouvrira sans lieu.
  }
}

// Rend le lieu retenu et l'oublie : il ne s'ouvre qu'une fois.
export function reprendreLieu(): string | null {
  try {
    const id = sessionStorage.getItem(CLE)
    sessionStorage.removeItem(CLE)
    return id
  } catch {
    return null
  }
}
