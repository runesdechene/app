/**
 * QUOI     — le choix d'une icône dans un tiroir (nature, culture) : l'envoi tout de suite, le refus d'un
 *            fichier, l'icône courante, et le ménage du bucket.
 * POURQUOI — une nouvelle icône part avant l'enregistrement, donc deux fichiers peuvent traîner. Une icône
 *            envoyée puis remplacée n'est référencée par personne : elle est retirée aussitôt. L'icône déjà
 *            enregistrée, elle, est encore lue par la fiche : elle n'est retirée qu'une fois la nouvelle
 *            enregistrée. Les retraits sont au mieux : un fichier orphelin vaut mieux qu'un enregistrement raté.
 */
import { useState, type ChangeEvent } from 'react'
import { envoyerFichier, retirerFichier, verifierFichier, type RegleFichier } from '@/shared/lib/envoi'

export function useIconeEnvoyee(bucket: string, iconeEnregistree: string | null) {
  const [icone, setIcone] = useState(iconeEnregistree ?? '')
  const [envoiEnCours, setEnvoiEnCours] = useState(false)
  const [refus, setRefus] = useState<string | null>(null)

  async function choisir({ target }: Pick<ChangeEvent<HTMLInputElement>, 'target'>, regle: RegleFichier, chemin: (fichier: File) => string) {
    const fichier = target.files?.[0]
    // Le champ est vidé : choisir de nouveau le même fichier (après un refus) déclenche encore l'événement.
    target.value = ''
    if (!fichier) return
    const erreur = verifierFichier(fichier, regle)
    setRefus(erreur)
    if (erreur) return
    setEnvoiEnCours(true)
    try {
      const adresse = await envoyerFichier(bucket, chemin(fichier), fichier)
      if (icone && icone !== iconeEnregistree) await retirerFichier(bucket, icone).catch(() => undefined)
      setIcone(adresse)
    } catch (err) {
      setRefus(err instanceof Error ? err.message : 'L’envoi a échoué.')
    } finally {
      setEnvoiEnCours(false)
    }
  }

  // À appeler quand la fiche est enregistrée avec l'icône courante.
  function apresEnregistrement() {
    setRefus(null)
    if (iconeEnregistree && iconeEnregistree !== icone) void retirerFichier(bucket, iconeEnregistree).catch(() => undefined)
  }

  return { icone, envoiEnCours, refus, choisir, apresEnregistrement }
}
