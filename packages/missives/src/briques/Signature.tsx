// La formule de fin et la signature d'Uriel.

import { Column, Img, Row, Section, Text } from '@react-email/components';
import { BEBAS, EnImage, styleCorps, styleRubrique, useEncre, Zone } from './encre';

export function Signature({ salut }: { salut?: string }) {
  const { couleurs: c, adresse } = useEncre();
  return (
    <Section style={{ padding: '48px 48px 0' }}>
      {salut !== undefined && (
        <Text style={{ ...styleCorps(c.texte), marginBottom: '16px' }}>
          <Zone nom="salut" valeur={salut} />
        </Text>
      )}
      <Row>
        <Column width="82">
          <Img src={`${adresse}/uriel.png`} alt="Uriel" width="82" height="82" style={{ borderRadius: '50%' }} />
        </Column>
        <Column style={{ paddingLeft: '25px' }}>
          <Text style={{ fontFamily: BEBAS, fontSize: '56px', lineHeight: '52px', letterSpacing: '0.02em', color: c.titres, margin: 0 }}>
            <EnImage zone="signature" texte="URIEL">
              URIEL
            </EnImage>
          </Text>
          <Text style={styleRubrique(c.rubriques)}>CRÉATEUR DE RUNES DE CHÊNE</Text>
        </Column>
      </Row>
    </Section>
  );
}
