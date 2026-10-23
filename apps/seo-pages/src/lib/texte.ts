/**
 * QUOI     — ce que tous les gabarits partagent : échapper le HTML, dire une date en français,
 *            nommer un département avec son numéro (« Ain (01) »).
 */
export function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function dateFr(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Hors de France, le pays seul.
export function region(nom: string | null, numeros: Map<string, string>): string | null {
  if (!nom) return null;
  const numero = numeros.get(nom);
  return numero ? `${nom} (${numero})` : nom;
}

// Le récit en paragraphes : une ligne vide ou un retour à la ligne les sépare.
export function paragraphes(texte: string): string {
  return texte
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${echapper(p)}</p>`)
    .join('\n');
}

// Une image Supabase à la taille où on l'affiche, au double pour les écrans nets (comme
// aLaTaille dans l'appli). `resize=contain` : sans lui, Supabase recadre.
// Une photo de lieu est déjà réduite à l'envoi : on sert la grande ou sa `_thumb.webp` telle quelle,
// car Supabase facture chaque image redimensionnée, et les robots visitent toutes les fiches.
const OBJET = '/storage/v1/object/public/';
const RENDU = '/storage/v1/render/image/public/';
const PHOTO_DE_LIEU = /\/place-images\/(places|rapatrie)\/.+\.webp$/;

export function aLaTaille(url: string, largeurAffichee: number): string {
  if (!url.includes(OBJET)) return url;
  if (PHOTO_DE_LIEU.test(url)) {
    return largeurAffichee <= 300 ? url.replace(/(_thumb)?\.webp$/, '_thumb.webp') : url;
  }
  const largeur = Math.min(2000, Math.round(largeurAffichee * 2));
  const separateur = url.includes('?') ? '&' : '?';
  return `${url.replace(OBJET, RENDU)}${separateur}width=${largeur}&quality=70&resize=contain`;
}
