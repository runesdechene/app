/**
 * QUOI     — la clé d'un lien d'invitation de Compagnie (`?company=<clé>`).
 * POURQUOI — lue par Invitation.tsx ; à part pour se tester seule (et pour le rechargement à chaud).
 */
export function cleDInvitation(search: string): string | null {
  return new URLSearchParams(search).get('company')
}
