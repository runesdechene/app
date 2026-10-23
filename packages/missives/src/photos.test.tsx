import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PALETTES } from './couleurs';
import { EXEMPLES } from './exemples';
import { Carnet } from './modeles/Carnet';
import { photosPenchees } from './photos';
import { rendre } from './rendre';

describe('photosPenchees', () => {
  it('dit quelles photos penchent, de combien, et sur quelle couleur', () => {
    const carnet = { modele: 'carnet' as const, contenu: EXEMPLES.carnet };
    expect(photosPenchees(carnet)).toEqual([
      { zone: 'photo.url', url: EXEMPLES.carnet.photo.url, degres: 2, sur: 'fond' },
      { zone: 'tirages.gauche', url: EXEMPLES.carnet.tirages.gauche, degres: -3, sur: 'fond' },
      { zone: 'tirages.droite', url: EXEMPLES.carnet.tirages.droite, degres: 2.5, sur: 'fond' },
    ]);
  });

  it('une photo droite ne penche pas', () => {
    const fragment = { modele: 'fragment' as const, contenu: EXEMPLES.fragment };
    expect(photosPenchees(fragment)).toEqual([]);
  });
});

describe('la photo penchée', () => {
  it('dans le Hub, penche à l’écran : ses coins prennent les couleurs du moment', () => {
    const html = renderToStaticMarkup(
      <Carnet contenu={EXEMPLES.carnet} couleurs={PALETTES.hiver} apercu="" edition={{ onChange: () => undefined }} />,
    );
    expect(html).toMatch(/rotate\(2deg\)/);
    expect(html).toMatch(/rotate\(-3deg\)/);
  });

  it('dans l’e-mail, ne penche pas : la photo envoyée l’est déjà', async () => {
    const { html } = await rendre(
      { modele: 'carnet', contenu: EXEMPLES.carnet, couleurs: PALETTES.hiver, apercu: '' },
      { prenom: null, lienDesabonnement: 'https://x' },
    );
    expect(html).not.toMatch(/rotate\(/);
  });
});
