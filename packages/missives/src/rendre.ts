// Une Missive prête à partir : le HTML et sa version texte, pour un destinataire.

import { render } from '@react-email/render';
import { createElement } from 'react';
import type { Couleurs } from './couleurs';
import { Carnet } from './modeles/Carnet';
import { Fragment } from './modeles/Fragment';
import { Missive } from './modeles/Missive';
import type { Destinataire, Lettre } from './types';

export type Envoi = Lettre & { couleurs: Couleurs; apercu: string };

// Un lien d'une lettre peut viser « {questionnaire} », suivi ou non de « ?epoque=… » : la page « Dis-nous qui tu es ».
export const PAGE_QUESTIONNAIRE = 'https://hub.runesdechene.com/qui-es-tu';

/** Chaque « {questionnaire} » devient le lien de la personne ; ce qui suit son « ? » se raccroche avec `et`. */
function poserLeQuestionnaire(texte: string, lien: string, et: string): string {
  return texte.replace(/\{questionnaire\}(\?)?/g, (_, suite?: string) => (suite ? lien + (lien.includes('?') ? et : '?') : lien));
}

export async function rendre(envoi: Envoi, destinataire: Destinataire): Promise<{ html: string; texte: string }> {
  const props = { couleurs: envoi.couleurs, apercu: envoi.apercu, destinataire };
  const page =
    envoi.modele === 'missive'
      ? createElement(Missive, { ...props, contenu: envoi.contenu })
      : envoi.modele === 'fragment'
        ? createElement(Fragment, { ...props, contenu: envoi.contenu })
        : createElement(Carnet, { ...props, contenu: envoi.contenu });
  const [html, texte] = await Promise.all([render(page), render(page, { plainText: true })]);
  const lien = destinataire.lienQuestionnaire ?? PAGE_QUESTIONNAIRE;
  return { html: poserLeQuestionnaire(html, lien, '&amp;'), texte: poserLeQuestionnaire(texte, lien, '&') };
}
