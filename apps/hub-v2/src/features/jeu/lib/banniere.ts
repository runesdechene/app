/**
 * QUOI     — le voile et l'ombre du texte d'une bannière d'Accueil, et la règle du lien.
 * POURQUOI — degradeDeVoile et ombreDeTexte reprennent tels quels buildOverlayGradient et buildTextShadow de
 *            l'ancien Hub (Banners, retiré le 16/10), qui devaient rester alignés sur l'Accueil : la V2
 *            (apps/web-v2/src/features/accueil/components/Banniere.module.css) fait le même calcul en CSS
 *            (force, puis 58,8 % et 23,5 % d'elle ; ombre « 0 1px 3px »). Le lien se vérifie comme la V2 (lireAccueil.ts,
 *            estHttp) : une adresse lisible en http(s), sinon la V2 n'affiche pas la bannière.
 */
function canaux(couleur: string): string {
  const r = parseInt(couleur.slice(1, 3), 16) || 0
  const g = parseInt(couleur.slice(3, 5), 16) || 0
  const b = parseInt(couleur.slice(5, 7), 16) || 0
  return `${String(r)},${String(g)},${String(b)}`
}

export function degradeDeVoile(couleur: string, opacite: number): string {
  const rgb = canaux(couleur)
  const op = Math.max(0, Math.min(1, opacite))
  const milieu = op * (0.5 / 0.85)
  const droite = op * (0.2 / 0.85)
  return `linear-gradient(90deg, rgba(${rgb},${String(op)}) 0%, rgba(${rgb},${String(milieu)}) 60%, rgba(${rgb},${String(droite)}) 100%)`
}

export function ombreDeTexte(couleur: string, force: number): string {
  const s = Math.max(0, Math.min(1, force))
  if (s === 0) return 'none'
  return `0 1px 3px rgba(${canaux(couleur)},${String(s)})`
}

export function lienValide(url: string): boolean {
  return URL.canParse(url) && ['http:', 'https:'].includes(new URL(url).protocol)
}

// L'image d'une bannière : jpeg, png ou webp, 5 Mo au plus (règle du bucket home-banners).
export const REGLE_IMAGE = { types: ['image/jpeg', 'image/png', 'image/webp'], maxOctets: 5 * 1024 * 1024 }
