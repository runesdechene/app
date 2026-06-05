import { createHash } from 'node:crypto';

/**
 * Seuil (en caractères) au-dessus duquel le texte écrit par l'utilisateur est
 * jugé suffisamment riche pour être affiché tel quel sur la page SEO publique.
 * En dessous, Claude Haiku prend le relais (filet de sécurité).
 */
export const RICH_TEXT_MIN = 180;

export function isRichText(text: string | null | undefined): boolean {
  return !!text && text.trim().length >= RICH_TEXT_MIN;
}

/**
 * Empreinte des sources ayant servi à générer une `seo_description`
 * (texte du lieu + récits utilisés). Permet de régénérer la SEO d'un lieu
 * à texte pauvre quand sa source évolue, et de la laisser figée sinon.
 */
export function seoSourceHash(text: string | null | undefined, contributionContents: string[]): string {
  const payload = [(text ?? '').trim(), ...contributionContents.map((c) => (c ?? '').trim())].join('');
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

/**
 * Décide quelle description afficher dans le corps de la page publique :
 * - texte de l'utilisateur en priorité dès qu'il est assez riche (voix authentique) ;
 * - sinon la description Haiku en secours, ou à défaut le texte court tel quel.
 */
export function selectBodyDescription(
  text: string | null | undefined,
  seoDescription: string | null | undefined
): { description: string | null; isUserAuthored: boolean } {
  const userText = (text ?? '').trim();
  if (userText.length >= RICH_TEXT_MIN) {
    return { description: userText, isUserAuthored: true };
  }
  return { description: (seoDescription ?? '').trim() || userText || null, isUserAuthored: false };
}
