/**
 * QUOI     — où mène un Fragment reconnu (ou choisi dans la liste) : son Récit.
 * POURQUOI — un membre le lit dans l'appli, avec ses onglets ; un visiteur sur la page publique du
 *            scan (spec 2026-10-09-v2-scan, parcours 5).
 */
export function cheminDuRecit(id: number, connecte: boolean): string {
  return connecte ? `/accueil/fragment/${String(id)}` : `/scan/fragment/${String(id)}`
}
