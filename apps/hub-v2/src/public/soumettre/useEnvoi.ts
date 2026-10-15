/**
 * QUOI     — l'envoi d'une soumission : chaque fichier compressé puis déposé, l'un après l'autre,
 *            puis l'enregistrement par `deposer_contenu`.
 * POURQUOI — les fichiers partent AVANT toute écriture : un échec ne laisse jamais de soumission
 *            vide, et un fichier fautif (vidéo trop lourde pour le réseau, format exotique) reste
 *            de côté sans emporter les autres. Si aucun ne part, rien n'est enregistré et le
 *            formulaire reste tel quel pour réessayer.
 */
import { useState } from 'react'
import { deposerContenu, envoyerFichierPublic, PAS_ENREGISTRE, TROP_D_ENVOIS, type Depot } from './api'
import { versWebp } from './lib/compression'
import { tailleEnCm, type Contenu, type Histoire, type Toi } from './lib/formulaire'

export const AUCUN_FICHIER = 'Aucun fichier n’a pu partir. Vérifie ta connexion, puis réessaie.'

// Les seules phrases qu'un visiteur lit ; toute autre erreur devient PAS_ENREGISTRE.
const PHRASES_PUBLIQUES = [AUCUN_FICHIER, TROP_D_ENVOIS, PAS_ENREGISTRE]

export type Reussite = { nouveauCompte: boolean; partis: number; total: number }

export function useEnvoi() {
  const [progression, setProgression] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [reussite, setReussite] = useState<Reussite | null>(null)

  async function envoyer(contenus: Contenu[], histoire: Histoire, toi: Toi, quete: string) {
    setErreur(null)
    try {
      const dossier = crypto.randomUUID()
      const images: Depot['images'] = []
      for (const [i, c] of contenus.entries()) {
        setProgression(`Envoi du fichier ${String(i + 1)} sur ${String(contenus.length)}…`)
        try {
          const pret = await versWebp(c.fichier).catch(() => c.fichier)
          images.push({ path: await envoyerFichierPublic(pret, dossier), size: c.taille })
        } catch {
          // Ce fichier reste de côté ; les autres partent quand même.
        }
      }
      if (images.length === 0) throw new Error(AUCUN_FICHIER)

      setProgression('Enregistrement…')
      const { nouveauCompte } = await deposerContenu({
        email: toi.email,
        nom: toi.prenom,
        images,
        accordMarque: toi.accordMarque,
        accordCompte: toi.accordCompte,
        message: histoire.avis,
        departement: histoire.departement,
        quete,
        tailleCm: tailleEnCm(toi.tailleCm),
        noteExperience: histoire.noteExperience,
        noteProduits: histoire.noteProduits,
        motEquipe: histoire.motEquipe,
      })
      setReussite({ nouveauCompte, partis: images.length, total: contenus.length })
    } catch (e) {
      setErreur(e instanceof Error && PHRASES_PUBLIQUES.includes(e.message) ? e.message : PAS_ENREGISTRE)
    } finally {
      setProgression(null)
    }
  }

  return { envoyer, progression, erreur, reussite }
}
