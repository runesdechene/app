// L'ouverture : sa première lettre dans un carré de la couleur de rupture, puis le corps de la lettre.

import { Column, Row, Section, Text } from '@react-email/components';
import { ALEGREYA, BEBAS, Paragraphes, styleCorps, useEncre, Zone } from './encre';

export function Lettrine({ ouverture, corps }: { ouverture: string; corps: string }) {
  const { couleurs: c } = useEncre();
  const premiere = ouverture.slice(0, 1);
  return (
    <Section style={{ padding: '40px 48px 0' }}>
      <Row>
        <Column
          width="84"
          height="84"
          align="center"
          valign="middle"
          style={{ backgroundColor: c.rupture, fontFamily: BEBAS, fontSize: '80px', lineHeight: '72px', color: c.titres }}
        >
          {premiere}
        </Column>
        <Column style={{ paddingLeft: '18px', verticalAlign: 'top' }}>
          <Text style={{ fontFamily: ALEGREYA, fontWeight: 500, fontSize: '20px', lineHeight: '32px', color: c.texte, margin: 0 }}>
            <Zone nom="ouverture" valeur={ouverture.slice(1)} avant={premiere} />
          </Text>
        </Column>
      </Row>
      <Section style={{ paddingTop: '16px' }}>
        <Paragraphes nom="corps" valeur={corps} style={styleCorps(c.texte)} />
      </Section>
    </Section>
  );
}
