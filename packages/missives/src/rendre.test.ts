import { describe, expect, it } from 'vitest';
import { PALETTES } from './couleurs';
import { EXEMPLES } from './exemples';
import { rendre } from './rendre';
import type { Lettre } from './types';

const destinataire = { prenom: 'Kelpie', lienDesabonnement: 'https://hub.runesdechene.com/desabonnement?j=abc.def' };
const lettres: Lettre[] = [
  { modele: 'missive', contenu: EXEMPLES.missive },
  { modele: 'fragment', contenu: EXEMPLES.fragment },
  { modele: 'carnet', contenu: EXEMPLES.carnet },
];

function envoi(lettre: Lettre) {
  return { ...lettre, couleurs: PALETTES.hiver, apercu: 'Ce qui se prépare à l’atelier' };
}

describe.each(lettres)('rendre($modele)', (lettre) => {
  it('porte le titre, le désabonnement et la ligne d’aperçu', async () => {
    const { html, texte } = await rendre(envoi(lettre), destinataire);
    expect(html).toContain(lettre.contenu.titre);
    expect(html).toContain(destinataire.lienDesabonnement);
    expect(html).toContain('Ce qui se prépare à l’atelier');
    expect(texte).toContain(lettre.contenu.titre);
  });

  it('n’a aucune italique', async () => {
    const { html } = await rendre(envoi(lettre), destinataire);
    expect(html).not.toMatch(/font-style:\s*italic/);
    expect(html).not.toMatch(/<(em|i)[ >]/);
  });

  it('tient dans 600 px avec un titre de 90 caractères et une nouvelle de 2 000', async () => {
    const long = {
      ...lettre,
      contenu: { ...lettre.contenu, titre: 'T'.repeat(90), corps: 'Mot '.repeat(500) },
    } as Lettre;
    const { html } = await rendre(envoi(long), destinataire);
    expect(html).toContain('max-width:600px');
    const largeurs = [...html.matchAll(/(?:width[:=]"?)(\d+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...largeurs)).toBeLessThanOrEqual(600);
  });
});

describe('le prénom', () => {
  it('salue par le prénom', async () => {
    const { html } = await rendre(envoi(lettres[0]!), destinataire);
    expect(html).toContain('alut Kelpie');
  });

  it('salue « Explorateur » sans prénom, jamais « Salut , »', async () => {
    const { html } = await rendre(envoi(lettres[0]!), { ...destinataire, prenom: null });
    expect(html).toContain('alut Explorateur');
    expect(html).not.toContain('{prénom}');
  });
});
