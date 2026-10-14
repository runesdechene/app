/**
 * QUOI     — la phrase d'une ligne du fil : un titre (qui, quoi) et un détail réservé à l'équipe.
 * POURQUOI — fonction pure : chaque cas se teste seul ; la base ne rend que des faits.
 * ATTENTION — un compte supprimé s'appelle « Un Voyageur » ; un lieu disparu se dit « un lieu ».
 *            La base ne connaît pas le genre : les accords restent au masculin.
 */
import type { Activite } from '../api/fil'

const PROVENANCES: Record<string, string> = {
  app: 'Inscrit dans l’appli', shopify: 'Venu de la boutique', stand: 'Inscrit au stand', flyer: 'Arrivé par un flyer',
}

function texte(v: string | number | boolean | null | undefined): string {
  return v === null || v === undefined ? '' : String(v)
}

export function phraseDuFil(a: Activite): { titre: string; detail: string } {
  const qui = a.qui?.nom ?? 'Un Voyageur'
  const lieu = a.lieu ? `« ${a.lieu.nom} »` : 'un lieu'
  const d = a.donnees

  switch (a.type) {
    case 'compte':
      if (a.sorte === 'reactivation') return { titre: `${qui} a réactivé son ancien compte`, detail: `Inscrit le ${new Date(texte(d.inscrit)).toLocaleDateString('fr-FR')}` }
      return {
        titre: `${qui} s’est inscrit`,
        detail: [PROVENANCES[texte(d.provenance)] ?? 'Provenance inconnue', d.client ? 'client validé' : ''].filter(Boolean).join(' · '),
      }
    case 'lieu':
      if (a.sorte === 'modification') return { titre: `${qui} a modifié ${lieu}`, detail: 'Nouvelle version de la fiche' }
      return { titre: `${qui} a ajouté ${lieu}`, detail: d.verifie ? 'Vérifié' : 'En attente de modération' }
    case 'visite':
      return { titre: `${qui} a posé sa marque à ${lieu}`, detail: d.premiere ? 'Premier passage sur place à ce lieu' : 'Sur place' }
    case 'enigme': {
      const culture = d.culture ? `Culture ${texte(d.culture)} · ` : ''
      const essai = Number(d.essai)
      if (a.sorte === 'percee') return { titre: `${qui} a percé l’énigme n° ${texte(d.enigme)}`, detail: `${culture}juste au ${essai === 1 ? '1er' : `${String(essai)}e`} essai` }
      return { titre: `${qui} a manqué l’énigme n° ${texte(d.enigme)}`, detail: `${culture}${String(essai)}e essai` }
    }
    case 'boutique':
      return { titre: `${qui} a débloqué le Fragment ${texte(d.fragment) || 'inconnu'}`, detail: d.source === 'shopify' ? 'Par une commande Shopify' : 'Associé à la main' }
    case 'photo':
      return { titre: `${texte(d.nom) || qui} a envoyé une contribution`, detail: [texte(d.produit), d.note ? `${texte(d.note)}/5` : '', d.statut === 'pending' ? 'à valider' : ''].filter(Boolean).join(' · ') }
    case 'message':
      return { titre: `${qui} a écrit dans un canal`, detail: `Canal ${texte(d.canal)}` }
    case 'moderation':
      return { titre: a.sorte === 'signalement_lieu' ? `${qui} a signalé ${lieu}` : `${qui} a signalé l’énigme n° ${texte(d.enigme)}`, detail: `Motif : ${texte(d.motif)}` }
    case 'notification':
      return { titre: `Notification « ${a.sorte} » envoyée`, detail: `${texte(d.envoyees)} destinataires · ${texte(d.lues)} l’ont lue` }
  }
}
