// Le haut de la lettre : les deux mentions, le logo, le grand titre et son sous-titre.

import { Column, Heading, Img, Row, Section, Text } from '@react-email/components';
import type { Photo as PhotoContenu } from '../types';
import { Photo } from './Photo';
import { BEBAS, styleRubrique, useEncre, Zone } from './encre';

type Props = {
  enTete: { gauche: string; droite: string };
  titre: string;
  sousTitre: string;
  /** Le corps du grand titre : un seul mot se lit en très grand, une phrase plus petit. */
  taille: number;
};

export function EnTete({ enTete, titre, sousTitre, taille }: Props) {
  const { couleurs: c, adresse } = useEncre();
  return (
    <>
      <Section style={{ padding: '0 48px' }}>
        <Row>
          <Column style={styleRubrique(c.rubriques)}>
            <Zone nom="enTete.gauche" valeur={enTete.gauche} />
          </Column>
          <Column align="right" style={styleRubrique(c.rubriques)}>
            <Zone nom="enTete.droite" valeur={enTete.droite} />
          </Column>
        </Row>
      </Section>
      <Img
        src={`${adresse}/logo-creme.png`}
        alt="Runes de Chêne"
        width="203"
        style={{ margin: '20px auto 24px', display: 'block' }}
      />
      <Heading
        as="h1"
        style={{
          fontFamily: BEBAS,
          fontWeight: 400,
          fontSize: `${taille}px`,
          lineHeight: 0.92,
          letterSpacing: '0.02em',
          color: c.titres,
          textAlign: 'center',
          margin: '0 40px',
          wordBreak: 'break-word',
        }}
      >
        <Zone nom="titre" valeur={titre} />
      </Heading>
      <Text style={{ ...styleRubrique(c.texte, 14), letterSpacing: '0.22em', textAlign: 'center', margin: '10px 0 30px' }}>
        <Zone nom="sousTitre" valeur={sousTitre} />
      </Text>
    </>
  );
}

/** Une photo d'un bord à l'autre, déjà penchée par le Hub, et sa légende. */
export function Planche({ photo, nom = 'photo' }: { photo: PhotoContenu; nom?: string }) {
  const { couleurs: c } = useEncre();
  return (
    <>
      <Photo src={photo.url} zone={`${nom}.url`} largeur={600} degres={photo.inclinaison} style={{ width: '100%' }} />
      <Text style={{ ...styleRubrique(c.rubriques, 11), padding: '10px 48px 0' }}>
        <Zone nom={`${nom}.legende`} valeur={photo.legende} />
      </Text>
    </>
  );
}
