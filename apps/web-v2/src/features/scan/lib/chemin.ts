/**
 * QUOI     — où mène un Fragment reconnu (ou choisi dans la liste) : sa fiche.
 * POURQUOI — un membre la lit dans son Codex (spec 2026-11-02-codex) ; un visiteur sur la page
 *            publique du scan (spec 2026-10-09-v2-scan, parcours 5).
 */
export function cheminDuRecit(id: number, connecte: boolean): string {
  return connecte ? `/codex/fragment/${String(id)}` : `/scan/fragment/${String(id)}`
}
