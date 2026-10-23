// Le contenu des trois modèles : un champ par zone des maquettes (Figma App v2, page « Hub Emails »).
// Un texte peut porter « {prénom} », remplacé à l'envoi. Un corps sépare ses paragraphes par une ligne vide.

import type { Couleurs } from './couleurs';

export type Modele = 'missive' | 'fragment' | 'carnet';

export type Photo = { url: string; legende: string; inclinaison: number };
export type Appel = { texte: string; lien: string };

/** Un titre en Bebas photographié par le Hub à l'envoi : Gmail et Outlook ignorent les polices web. */
export type TitreEnImage = { src: string; largeur: number; hauteur: number };

type Commun = {
  enTete: { gauche: string; droite: string };
  titre: string;
  sousTitre: string;
  photo: Photo;
  ouverture: string;
  corps: string;
  /** Posé par le Hub dans la lettre qui part (contenu_envoi), jamais dans le brouillon. Clé : la zone du titre. */
  titresEnImages?: Record<string, TitreEnImage>;
};

export type Nouvelle = { titre: string; texte: string; appel: Appel };

export type ContenuMissive = Commun & {
  rubriqueNouvelles: string;
  nouvelles: Nouvelle[];
  rupture: { titre: string; texte: string; appel: Appel; photo: string | null };
  salut: string;
};

export type Piece = { photo: string; nom: string; prix: string };

export type ContenuFragment = Commun & {
  histoire: Appel;
  rupture: { titre: string; texte: string };
  pieces: Piece[];
  autresCoupes: string;
  appel: Appel;
};

export type Halte = { date: string; lieu: string; lien: string };

export type ContenuCarnet = Commun & {
  tirages: { gauche: string; droite: string; legende: string };
  rupture: { titre: string; texte: string; haltes: Halte[]; appel: Appel };
  salut: string;
};

export type Lettre =
  | { modele: 'missive'; contenu: ContenuMissive }
  | { modele: 'fragment'; contenu: ContenuFragment }
  | { modele: 'carnet'; contenu: ContenuCarnet };

/** `lienQuestionnaire` : le lien personnel du questionnaire, qui remplace `{questionnaire}` dans les liens. */
export type Destinataire = { prenom: string | null; lienDesabonnement: string; lienQuestionnaire?: string };

/** Le Hub passe `edition` pour rendre chaque zone de texte modifiable sur place. */
export type Edition = { onChange(zone: string, valeur: string): void };

export type ProprietesModele<C> = {
  contenu: C;
  couleurs: Couleurs;
  apercu: string;
  /** Absent dans le Hub : « {prénom} » reste visible et le lien de désabonnement est inerte. */
  destinataire?: Destinataire;
  edition?: Edition;
};
