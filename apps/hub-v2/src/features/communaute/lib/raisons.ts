/**
 * QUOI     — les raisons d'un signalement, en français lisible.
 * POURQUOI — la base garde le code (`prive_ou_dangereux`), l'écran le dit en clair.
 */
export const RAISONS: Record<string, string> = {
  n_existe_pas: 'Le lieu n’existe pas',
  prive_ou_dangereux: 'Lieu privé ou dangereux',
  doublon: 'Doublon',
  contenu: 'Contenu inapproprié',
  autre: 'Autre',
}
