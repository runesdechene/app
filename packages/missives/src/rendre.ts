// Une Missive prête à partir : le HTML et sa version texte, pour un destinataire.

import { render } from '@react-email/render';
import { createElement } from 'react';
import type { Couleurs } from './couleurs';
import { Carnet } from './modeles/Carnet';
import { Fragment } from './modeles/Fragment';
import { Missive } from './modeles/Missive';
import type { Destinataire, Lettre } from './types';

export type Envoi = Lettre & { couleurs: Couleurs; apercu: string };

export async function rendre(envoi: Envoi, destinataire: Destinataire): Promise<{ html: string; texte: string }> {
  const props = { couleurs: envoi.couleurs, apercu: envoi.apercu, destinataire };
  const page =
    envoi.modele === 'missive'
      ? createElement(Missive, { ...props, contenu: envoi.contenu })
      : envoi.modele === 'fragment'
        ? createElement(Fragment, { ...props, contenu: envoi.contenu })
        : createElement(Carnet, { ...props, contenu: envoi.contenu });
  const [html, texte] = await Promise.all([render(page), render(page, { plainText: true })]);
  return { html, texte };
}
