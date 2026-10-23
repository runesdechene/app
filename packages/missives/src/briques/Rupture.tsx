// La bande pleine largeur dans la couleur de rupture, et l'appel en grandes lettres soulignées.

import { Link, Section, Text } from '@react-email/components';
import type { CSSProperties, ReactNode } from 'react';
import type { Appel as AppelContenu } from '../types';
import { BEBAS, EnImage, useEncre, Zone } from './encre';

export function Rupture({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const { couleurs: c } = useEncre();
  return <Section style={{ backgroundColor: c.rupture, padding: '40px 48px', marginTop: '40px', ...style }}>{children}</Section>;
}

export function TitreRupture({ nom, valeur, taille }: { nom: string; valeur: string; taille: number }) {
  const { couleurs: c } = useEncre();
  return (
    <Text
      style={{
        fontFamily: BEBAS,
        fontSize: `${taille}px`,
        lineHeight: 0.92,
        letterSpacing: '0.02em',
        color: c.titresRupture,
        margin: '0 0 10px',
        wordBreak: 'break-word',
      }}
    >
      <EnImage zone={nom} texte={valeur}>
        <Zone nom={nom} valeur={valeur} />
      </EnImage>
    </Text>
  );
}

/** Pas de bouton : les mots de l'appel, en grand, soulignés d'un trait épais. */
export function Appel({ nom, appel, couleur }: { nom: string; appel: AppelContenu; couleur: string }) {
  return (
    <Text style={{ margin: '16px 0 0' }}>
      <Link
        href={appel.lien}
        data-zone={`${nom}.lien`}
        style={{
          fontFamily: BEBAS,
          fontSize: '32px',
          lineHeight: '36px',
          letterSpacing: '0.03em',
          color: couleur,
          textDecoration: 'none',
          borderBottom: `3px solid ${couleur}`,
        }}
      >
        <EnImage zone={nom} texte={`${appel.texte} →`}>
          <Zone nom={`${nom}.texte`} valeur={appel.texte} /> →
        </EnImage>
      </Link>
    </Text>
  );
}
