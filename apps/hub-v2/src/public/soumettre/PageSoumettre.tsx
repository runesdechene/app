/**
 * QUOI     — /soumettre-contenu, où un joueur envoie ses photos et vidéos (?quete= pour une mission).
 * POURQUOI — pour l'instant, son seul titre ; la page vient avec sa tâche (plan 5, Task 9).
 */
import { PagePublique } from '../PagePublique'

export function PageSoumettre() {
  return (
    <PagePublique disposition="carte">
      <h1>Envoyer mes contenus</h1>
    </PagePublique>
  )
}
