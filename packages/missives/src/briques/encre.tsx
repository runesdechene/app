// Ce que toutes les briques partagent : les couleurs, le destinataire, le mode édition du Hub, les polices.

import { Img, Text } from '@react-email/components';
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import type { CouleursDeduites } from '../couleurs';
import type { Destinataire, Edition, TitreEnImage } from '../types';

type Encre = {
  couleurs: CouleursDeduites;
  destinataire: Destinataire | undefined;
  edition: Edition | undefined;
  /** Où trouver logo, portrait et polices. */
  adresse: string;
  /** Les titres photographiés par le Hub, pour l'e-mail ; absents dans l'éditeur. */
  titres: Record<string, TitreEnImage> | undefined;
};

const ContexteEncre = createContext<Encre | null>(null);
export const FournisseurEncre = ContexteEncre.Provider;

export function useEncre(): Encre {
  const encre = useContext(ContexteEncre);
  if (!encre) throw new Error('Une brique de Missive doit vivre dans un Cadre');
  return encre;
}

// Hébergées par le Hub (apps/hub-v2/public/missives) : une adresse absolue dans l'e-mail, lisible depuis n'importe
// quelle boîte ; relative dans le Hub, qui les sert lui-même, en local comme en ligne.
export const ADRESSE = 'https://hub.runesdechene.com/missives';
export const ADRESSE_DANS_LE_HUB = '/missives';

export const BEBAS = "'Bebas Neue', 'Arial Narrow', Arial, sans-serif";
// Gmail et Outlook ignorent Alegreya : Palatino la remplace (choix d'Uriel, 23/10), Georgia en dernier recours.
export const ALEGREYA = "Alegreya, 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";
export const CABIN = "'Cabin Condensed', 'Arial Narrow', Arial, sans-serif";

/** Les petites capitales espacées des rubriques, de l'en-tête et des légendes. */
export function styleRubrique(couleur: string, taille = 12): CSSProperties {
  return { fontFamily: CABIN, fontWeight: 700, fontSize: `${taille}px`, letterSpacing: '0.16em', color: couleur, margin: 0 };
}

export function styleCorps(couleur: string): CSSProperties {
  return { fontFamily: ALEGREYA, fontSize: '18px', lineHeight: '29px', color: couleur, margin: 0 };
}

/** Une zone de texte : modifiable sur place dans le Hub, personnalisée à l'envoi. */
export function Zone({ nom, valeur, avant = '' }: { nom: string; valeur: string; avant?: string }) {
  const { destinataire, edition } = useEncre();
  if (!edition) return <>{personnaliser(valeur, destinataire)}</>;
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      data-zone={nom}
      onBlur={(e) => edition.onChange(nom, avant + e.currentTarget.innerText)}
    >
      {valeur}
    </span>
  );
}

/** Un texte de plusieurs paragraphes, séparés par une ligne vide. */
export function Paragraphes({ nom, valeur, style }: { nom: string; valeur: string; style: CSSProperties }) {
  const { edition } = useEncre();
  if (edition) {
    return (
      <Text style={{ ...style, whiteSpace: 'pre-line' }}>
        <Zone nom={nom} valeur={valeur} />
      </Text>
    );
  }
  return valeur.split(/\n\s*\n/).map((paragraphe, i) => (
    <Text key={i} style={style}>
      <Zone nom={nom} valeur={paragraphe} />
    </Text>
  ));
}

/**
 * Un titre en Bebas. Dans l'éditeur, il est marqué (`data-titre`) pour que le Hub le photographie à l'envoi,
 * tel qu'il s'affiche, avec la vraie police. Dans l'e-mail, sa photo le remplace, son texte en description.
 */
export function EnImage({ zone, texte, centre = false, children }: { zone: string; texte: string; centre?: boolean; children: ReactNode }) {
  const { edition, titres } = useEncre();
  if (edition) {
    return (
      <span data-titre={zone} style={{ display: 'inline-block' }}>
        {children}
      </span>
    );
  }
  const image = titres?.[zone];
  if (!image) return <>{children}</>;
  return (
    <Img
      src={image.src}
      alt={texte}
      width={String(image.largeur)}
      height={String(image.hauteur)}
      style={{ display: 'block', margin: centre ? '0 auto' : 0, border: 0 }}
    />
  );
}

function personnaliser(valeur: string, destinataire: Destinataire | undefined): string {
  if (!destinataire) return valeur;
  return valeur.replaceAll('{prénom}', destinataire.prenom?.trim() || 'Explorateur');
}
