import { describe, expect, it } from 'vitest';
import { PALETTES, PALETTE_MARQUE, contrasteSuffisant, deduireCouleurs } from './couleurs';

describe('contrasteSuffisant', () => {
  it('accepte la palette de la marque et toutes les saisons', () => {
    expect(contrasteSuffisant(PALETTE_MARQUE)).toBe(true);
    for (const palette of Object.values(PALETTES)) expect(contrasteSuffisant(palette)).toBe(true);
  });

  it('refuse un texte qui se perd dans le fond', () => {
    expect(contrasteSuffisant({ fond: '#f5ead6', titres: '#f0e0c0', rupture: '#f5ead6' })).toBe(false);
  });
});

describe('deduireCouleurs', () => {
  it('écrit en crème sur un fond sombre', () => {
    expect(deduireCouleurs(PALETTE_MARQUE).texte).toBe('#f5ead6');
  });

  it('écrit à l’encre sur un fond clair', () => {
    expect(deduireCouleurs({ fond: '#f5ead6', titres: '#3f3024', rupture: '#a94842' }).texte).toBe('#3f3024');
  });

  it('garde les trois couleurs choisies', () => {
    expect(deduireCouleurs(PALETTE_MARQUE)).toMatchObject(PALETTE_MARQUE);
  });
});

describe('titresRupture', () => {
  it('passe au crème quand l’or ne se lit pas sur le rouge sceau', () => {
    expect(deduireCouleurs(PALETTE_MARQUE).titresRupture).toBe('#f5ead6');
  });

  it('garde les titres quand ils se lisent sur la bande', () => {
    expect(deduireCouleurs(PALETTES.hiver).titresRupture).toBe('#d6bd8c');
  });
});
