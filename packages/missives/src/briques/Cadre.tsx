// La page de l'e-mail : polices, aperçu, fond, colonne de 600 px, pied de page.

import { Body, Container, Head, Html, Link, Preview, Section, Text } from '@react-email/components';
import type { ReactNode } from 'react';
import { deduireCouleurs, type Couleurs } from '../couleurs';
import type { Destinataire, Edition, TitreEnImage } from '../types';
import { ADRESSE, ADRESSE_DANS_LE_HUB, ALEGREYA, FournisseurEncre } from './encre';

// Autour de la colonne, un vélin neutre : la lettre reste une page posée au centre, quel que soit son thème.
const VELIN = '#ece5d8';

const polices = (adresse: string) => `
@font-face { font-family: 'Bebas Neue'; font-weight: 400; src: url(${adresse}/polices/bebas-neue-latin-400-normal.woff2) format('woff2'); }
@font-face { font-family: 'Cabin Condensed'; font-weight: 700; src: url(${adresse}/polices/cabin-condensed-latin-700-normal.woff2) format('woff2'); }
@font-face { font-family: 'Alegreya'; font-weight: 400; src: url(${adresse}/polices/alegreya-latin-400-normal.woff2) format('woff2'); }
@font-face { font-family: 'Alegreya'; font-weight: 500; src: url(${adresse}/polices/alegreya-latin-500-normal.woff2) format('woff2'); }
@media (max-width: 480px) { .pile { display: block !important; width: 100% !important; padding: 0 0 16px !important; } }
`;

type Props = {
  couleurs: Couleurs;
  apercu: string;
  destinataire: Destinataire | undefined;
  edition: Edition | undefined;
  titres: Record<string, TitreEnImage> | undefined;
  children: ReactNode;
};

export function Cadre({ couleurs, apercu, destinataire, edition, titres, children }: Props) {
  const c = deduireCouleurs(couleurs);
  const adresse = edition ? ADRESSE_DANS_LE_HUB : ADRESSE;
  const colonne = (
    <Container style={{ maxWidth: '600px', width: '100%', backgroundColor: c.fond, paddingTop: '40px' }}>
      {children}
      <Section style={{ backgroundColor: c.pied, padding: '26px 48px 30px', marginTop: '48px' }}>
        <Text style={{ fontFamily: ALEGREYA, fontSize: '12px', lineHeight: '19px', color: c.rubriques, margin: '0 0 6px' }}>
          Runes de Chêne · 421 chemin de Baudaric, 06390 Contes
        </Text>
        <Text style={{ fontFamily: ALEGREYA, fontSize: '12px', lineHeight: '19px', color: c.rubriques, margin: 0 }}>
          Tu reçois cette lettre parce que tu as choisi de suivre Runes de Chêne.{' '}
          <Link href={destinataire?.lienDesabonnement ?? '#'} style={{ color: c.rubriques, textDecoration: 'underline' }}>
            Se désabonner
          </Link>
        </Text>
      </Section>
    </Container>
  );

  return (
    <FournisseurEncre value={{ couleurs: c, destinataire, edition, adresse, titres }}>
      {edition ? (
        // Dans le Hub, l'e-mail vit dans la page : la même colonne, sans l'enveloppe <html>.
        <div style={{ backgroundColor: c.fond }}>
          <style>{polices(adresse)}</style>
          {colonne}
        </div>
      ) : (
        <Html lang="fr">
          <Head>
            <style>{polices(adresse)}</style>
          </Head>
          <Preview>{apercu}</Preview>
          {/* Gmail ignore le fond du <body> : c'est une table pleine largeur qui porte le vélin. */}
          <Body style={{ margin: 0, backgroundColor: VELIN }}>
            <Section style={{ backgroundColor: VELIN, padding: '24px 0' }}>{colonne}</Section>
          </Body>
        </Html>
      )}
    </FournisseurEncre>
  );
}
