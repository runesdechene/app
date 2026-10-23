// Les trois couleurs d'une Missive, et tout ce qui s'en déduit (spec mailing, « Trois couleurs fondamentales »).

/** `autour` : la page autour de la colonne de 600 px (le vélin si rien n'est réglé). */
export type Couleurs = { fond: string; titres: string; rupture: string; autour?: string };

// Le vélin neutre autour de la lettre : elle reste une page posée au centre, quel que soit son thème.
export const VELIN = '#ece5d8';

export type CouleursDeduites = Couleurs & {
  texte: string;
  /** Le titre de la bande de rupture : les titres s'ils s'y lisent, sinon le texte. */
  titresRupture: string;
  rubriques: string;
  filet: string;
  pied: string;
};

export const PALETTE_MARQUE: Couleurs = { fond: '#3f3024', titres: '#c49a5a', rupture: '#a94842' };

// Hiver et automne viennent des maquettes (Missive d'hiver, Carnet de route) ; printemps et été sont à régler par Uriel.
export const PALETTES: Record<'marque' | 'hiver' | 'printemps' | 'ete' | 'automne', Couleurs> = {
  marque: PALETTE_MARQUE,
  hiver: { fond: '#1f2827', titres: '#d6bd8c', rupture: '#2a4845' },
  printemps: { fond: '#2c3a2a', titres: '#e2c98f', rupture: '#4f6136' },
  ete: { fond: '#3a2a1c', titres: '#e8b765', rupture: '#8c3b1f' },
  automne: { fond: '#1e231b', titres: '#d8bc8a', rupture: '#8a4528' },
};

const CREME = '#f5ead6';
const ENCRE = '#3f3024';
const NOIR = '#000000';

export function deduireCouleurs(c: Couleurs): CouleursDeduites {
  const texte = contraste(CREME, c.fond) >= contraste(ENCRE, c.fond) ? CREME : ENCRE;
  return {
    ...c,
    texte,
    titresRupture: contraste(c.titres, c.rupture) >= 3 ? c.titres : texte,
    rubriques: melanger(c.titres, texte, 0.35),
    filet: melanger(texte, c.fond, 0.15),
    pied: melanger(NOIR, c.fond, 0.3),
  };
}

// WCAG AA : 4,5:1 pour le texte courant (sur le fond et sur la bande), 3:1 pour les grands titres.
export function contrasteSuffisant(c: Couleurs): boolean {
  const { texte } = deduireCouleurs(c);
  return contraste(texte, c.fond) >= 4.5 && contraste(texte, c.rupture) >= 4.5 && contraste(c.titres, c.fond) >= 3;
}

/** `part` de `a` dans `b` : melanger(noir, blanc, 0.3) donne un gris clair. */
function melanger(a: string, b: string, part: number): string {
  const ca = canaux(a);
  const cb = canaux(b);
  return '#' + ca.map((v, i) => Math.round(v * part + (cb[i] ?? 0) * (1 - part)).toString(16).padStart(2, '0')).join('');
}

function contraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (clair + 0.05) / (sombre + 0.05);
}

function luminance(hex: string): number {
  const [r, g, b] = canaux(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function canaux(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
