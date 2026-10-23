import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PALETTES } from './couleurs';
import { EXEMPLES } from './exemples';
import { Fragment } from './modeles/Fragment';
import { rendre } from './rendre';

const destinataire = { prenom: null, lienDesabonnement: 'https://x' };

describe('les titres en Bebas', () => {
  it('dans l’éditeur, chacun est marqué pour être photographié', () => {
    const html = renderToStaticMarkup(
      <Fragment contenu={EXEMPLES.fragment} couleurs={PALETTES.hiver} apercu="" edition={{ onChange: () => undefined }} />,
    );
    for (const zone of ['titre', 'rupture.titre', 'appel', 'signature']) expect(html).toContain(`data-titre="${zone}"`);
  });

  it('à l’envoi, un titre photographié part en image, son texte en description', async () => {
    const contenu = {
      ...EXEMPLES.fragment,
      titresEnImages: { titre: { src: 'https://stockage/titre.png', largeur: 290, hauteur: 160 } },
    };
    const { html } = await rendre({ modele: 'fragment', contenu, couleurs: PALETTES.hiver, apercu: '' }, destinataire);
    expect(html).toMatch(/<img[^>]*alt="HÉCATE"[^>]*src="https:\/\/stockage\/titre.png"|<img[^>]*src="https:\/\/stockage\/titre.png"[^>]*alt="HÉCATE"/);
    expect(html).toContain('width="290"');
    // Les titres sans image restent du texte, et rien n'est marqué dans l'e-mail.
    expect(html).toContain('PORTER HÉCATE');
    expect(html).not.toContain('data-titre');
  });
});

describe('la version texte', () => {
  it('garde un titre parti en image', async () => {
    const contenu = { ...EXEMPLES.fragment, titresEnImages: { titre: { src: 'https://stockage/titre.png', largeur: 290, hauteur: 160 } } };
    const { texte } = await rendre({ modele: 'fragment', contenu, couleurs: PALETTES.hiver, apercu: '' }, destinataire);
    expect(texte).toContain('HÉCATE');
  });
});

describe('la place d’un titre en image', () => {
  it('est un bloc : la ligne du texte ne lui ajoute pas d’espace dessous', async () => {
    const contenu = { ...EXEMPLES.fragment, titresEnImages: { 'rupture.titre': { src: 'https://stockage/r.png', largeur: 300, hauteur: 66 } } };
    const { html } = await rendre({ modele: 'fragment', contenu, couleurs: PALETTES.hiver, apercu: '' }, destinataire);
    expect(html).toMatch(/<img[^>]*src="https:\/\/stockage\/r.png"[^>]*style="display:block/);
  });
});
