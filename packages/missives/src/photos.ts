// Les photos qui penchent, de combien, et sur quelle couleur (maquettes 748:2533, 748:2580, 745:2491).
// Un e-mail ne sait pas pencher une image : le Hub penche celles-ci au moment de l'envoi, sur ces couleurs ;
// dans l'éditeur, elles penchent à l'écran.

import type { Lettre } from './types';

export const INCLINAISONS = { rupture: 3, tirageGauche: -3, tirageDroite: 2.5 } as const;

export type PhotoPenchee = { zone: string; url: string; degres: number; sur: 'fond' | 'rupture' };

export function photosPenchees(lettre: Lettre): PhotoPenchee[] {
  const photos: PhotoPenchee[] = [
    { zone: 'photo.url', url: lettre.contenu.photo.url, degres: lettre.contenu.photo.inclinaison, sur: 'fond' },
  ];
  if (lettre.modele === 'missive' && lettre.contenu.rupture.photo) {
    photos.push({ zone: 'rupture.photo', url: lettre.contenu.rupture.photo, degres: INCLINAISONS.rupture, sur: 'rupture' });
  }
  if (lettre.modele === 'carnet') {
    photos.push(
      { zone: 'tirages.gauche', url: lettre.contenu.tirages.gauche, degres: INCLINAISONS.tirageGauche, sur: 'fond' },
      { zone: 'tirages.droite', url: lettre.contenu.tirages.droite, degres: INCLINAISONS.tirageDroite, sur: 'fond' },
    );
  }
  return photos.filter((p) => p.degres !== 0 && p.url !== '');
}
