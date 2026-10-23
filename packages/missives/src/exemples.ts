// Les textes et photos des maquettes : un point de départ pour écrire, et les tests.

import { ADRESSE } from './briques/encre';
import type { ContenuCarnet, ContenuFragment, ContenuMissive } from './types';

const missive: ContenuMissive = {
  enTete: { gauche: 'MISSIVE N° 12', droite: 'DÉCEMBRE' },
  titre: 'L’HIVER SE PRÉPARE À L’ATELIER',
  sousTitre: 'LES NOUVELLES DU MOIS',
  photo: { url: `${ADRESSE}/exemples/stand.jpg`, legende: '{LA LÉGENDE DE LA PHOTO}', inclinaison: -2 },
  ouverture: 'Salut {prénom}, les festivals se terminent et l’atelier se remplit. Voici ce qui s’y prépare.',
  corps:
    '{Ton mot du mois : ce que tu as vécu, ce qui t’a marqué, où en est la marque. Deux paragraphes courts, comme une lettre à un ami.}',
  rubriqueNouvelles: 'EN BREF',
  nouvelles: [
    {
      titre: 'UN FRAGMENT EST À L’ENCRE',
      texte: 'Le prochain Fragment est en train d’être dessiné. {Un indice, sans rien dévoiler.}',
      appel: { texte: 'EN SAVOIR PLUS', lien: 'https://runesdechene.com' },
    },
    {
      titre: 'NOS DERNIÈRES HALTES DE L’ANNÉE',
      texte: 'Deux marchés de Noël avant la pause : {ville} et {ville}.',
      appel: { texte: 'TOUTES NOS DATES', lien: 'https://runesdechene.com' },
    },
    {
      titre: 'SUR LA CARTE',
      texte: '{Une nouvelle de l’appli : un lieu remarquable ajouté par un Explorateur, une fonction nouvelle.}',
      appel: { texte: 'OUVRIR LA CARTE', lien: 'https://app.runesdechene.com' },
    },
  ],
  rupture: {
    titre: 'POUR NOËL, COMMANDE AVANT LE {DATE}',
    texte:
      'Chaque pièce est imprimée à la demande dans notre atelier. Passé cette date, on ne peut plus te promettre le pied du sapin.',
    appel: { texte: 'CHOISIR UN CADEAU', lien: 'https://runesdechene.com' },
    photo: `${ADRESSE}/exemples/tshirt-lavande.png`,
  },
  salut: 'Bonne fin d’année, et à très vite sur les chemins.',
};

const fragment: ContenuFragment = {
  enTete: { gauche: 'NOUVEAU FRAGMENT', droite: 'LE DROP DE NOVEMBRE' },
  titre: 'HÉCATE',
  sousTitre: 'GARDIENNE DES CARREFOURS',
  photo: { url: `${ADRESSE}/exemples/hecate.png`, legende: 'DESSINÉE À LA MAIN PAR LUNA · IMPRIMÉE EN BRETAGNE', inclinaison: 0 },
  ouverture: 'Elle se tenait à chaque carrefour, sans qu’aucun chemin ne lui échappe.',
  corps:
    'Hécate apparaît dans la littérature grecque dès le VIIIᵉ siècle avant notre ère, dans la Théogonie d’Hésiode. Déesse des carrefours, de la nuit et de la magie, elle préside aux seuils et aux passages. On la représente sous une forme triple, portant des flambeaux pour éclairer les ténèbres.\n\nLuna l’a dessinée trait par trait : trois visages, deux torches, et le serpent qui garde la porte.',
  histoire: { texte: 'ÉCOUTER SON HISTOIRE', lien: 'https://app.runesdechene.com' },
  rupture: {
    titre: 'PORTER HÉCATE',
    texte: 'Six coupes, de la nuit au pourpre. Coton biologique, imprimé dans notre atelier en Bretagne.',
  },
  pieces: [
    { photo: `${ADRESSE}/exemples/sweat-pourpre.png`, nom: 'Sweat à capuche · pourpre', prix: '89,90 €' },
    { photo: `${ADRESSE}/exemples/tshirt-lavande.png`, nom: 'T-shirt oversized · lavande', prix: '59,90 €' },
  ],
  autresCoupes:
    'Aussi en t-shirt (39,90 €), débardeur (29,90 €), veste zippée (99,90 €) et sweat premium (109,90 €).',
  appel: { texte: 'CHOISIR MA COUPE', lien: 'https://runesdechene.com' },
};

const carnet: ContenuCarnet = {
  enTete: { gauche: 'CARNET DE ROUTE', droite: 'NOVEMBRE' },
  titre: 'SUR LA ROUTE',
  sousTitre: 'NOUVELLES DU STAND NOMADE',
  photo: { url: `${ADRESSE}/exemples/stand-route.jpg`, legende: 'LE STAND AU {FESTIVAL}, {VILLE}', inclinaison: 2 },
  ouverture: 'Le camion a repris la route. Voici ce qu’on a vu, ceux qu’on a croisés, et où nous trouver d’ici l’hiver.',
  corps:
    '{Le récit du mois : une rencontre au stand, un lieu traversé, un moment qu’on garde. Deux ou trois paragraphes courts, dans ta voix.}',
  tirages: {
    gauche: `${ADRESSE}/exemples/uriel-comptoir.jpg`,
    droite: `${ADRESSE}/exemples/stand.jpg`,
    legende: 'À GAUCHE, URIEL DERRIÈRE LE COMPTOIR · À DROITE, {UN MOMENT}',
  },
  rupture: {
    titre: 'NOS PROCHAINES HALTES',
    texte: 'Viens nous voir : on aime mettre un visage sur les noms.',
    haltes: [
      { date: '8–9 NOV.', lieu: '{Festival} · {Ville}', lien: 'https://runesdechene.com' },
      { date: '22–23 NOV.', lieu: '{Festival} · {Ville}', lien: 'https://runesdechene.com' },
      { date: '13–14 DÉC.', lieu: '{Marché de Noël} · {Ville}', lien: 'https://runesdechene.com' },
    ],
    appel: { texte: 'TOUTES NOS DATES', lien: 'https://runesdechene.com' },
  },
  salut: 'Au plaisir de te croiser, sur les chemins ou sur un stand.',
};

export const EXEMPLES = { missive, fragment, carnet };
