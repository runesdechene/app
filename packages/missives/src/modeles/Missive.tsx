// La Missive : les nouvelles du mois (maquette Figma 748:2521).

import { Column, Link, Row, Section, Text } from '@react-email/components';
import { Cadre } from '../briques/Cadre';
import { Photo } from '../briques/Photo';
import { INCLINAISONS } from '../photos';
import { ALEGREYA, BEBAS, EnImage, styleCorps, styleRubrique, useEncre, Zone } from '../briques/encre';
import { EnTete, Planche } from '../briques/EnTete';
import { Lettrine } from '../briques/Lettrine';
import { Appel, Rupture, TitreRupture } from '../briques/Rupture';
import { Signature } from '../briques/Signature';
import type { ContenuMissive, Nouvelle as NouvelleContenu, ProprietesModele } from '../types';

const CHIFFRES = ['I', 'II', 'III', 'IV', 'V'];

export function Missive({ contenu, couleurs, apercu, destinataire, edition }: ProprietesModele<ContenuMissive>) {
  return (
    <Cadre couleurs={couleurs} apercu={apercu} destinataire={destinataire} edition={edition} titres={contenu.titresEnImages}>
      <EnTete enTete={contenu.enTete} titre={contenu.titre} sousTitre={contenu.sousTitre} taille={84} />
      <Planche photo={contenu.photo} />
      <Lettrine ouverture={contenu.ouverture} corps={contenu.corps} />
      <Nouvelles rubrique={contenu.rubriqueNouvelles} nouvelles={contenu.nouvelles} />
      <RuptureMissive rupture={contenu.rupture} />
      <Signature salut={contenu.salut} />
    </Cadre>
  );
}

function Nouvelles({ rubrique, nouvelles }: { rubrique: string; nouvelles: NouvelleContenu[] }) {
  const { couleurs: c } = useEncre();
  return (
    <Section style={{ padding: '44px 48px 0' }}>
      <Text style={{ ...styleRubrique(c.rubriques), marginBottom: '8px' }}>
        <Zone nom="rubriqueNouvelles" valeur={rubrique} />
      </Text>
      {nouvelles.map((nouvelle, i) => (
        <Row key={i} style={{ borderTop: `1px solid ${c.filet}` }}>
          <Column width="58" style={{ verticalAlign: 'top', padding: '18px 0' }}>
            <Text style={{ fontFamily: BEBAS, fontSize: '34px', lineHeight: '32px', color: c.titres, margin: 0 }}>
              <EnImage zone={`nouvelles.${String(i)}.chiffre`} texte={CHIFFRES[i] ?? ''}>
                {CHIFFRES[i]}
              </EnImage>
            </Text>
          </Column>
          <Column style={{ verticalAlign: 'top', padding: '18px 0' }}>
            <Text style={{ fontFamily: BEBAS, fontSize: '28px', lineHeight: '28px', letterSpacing: '0.02em', color: c.texte, margin: '0 0 6px' }}>
              <EnImage zone={`nouvelles.${String(i)}.titre`} texte={nouvelle.titre}>
                <Zone nom={`nouvelles.${i}.titre`} valeur={nouvelle.titre} />
              </EnImage>
            </Text>
            <Text style={{ fontFamily: ALEGREYA, fontSize: '17px', lineHeight: '27px', color: c.texte, margin: '0 0 6px' }}>
              <Zone nom={`nouvelles.${i}.texte`} valeur={nouvelle.texte} />
            </Text>
            <Link
              href={nouvelle.appel.lien}
              data-zone={`nouvelles.${i}.appel.lien`}
              style={{ ...styleRubrique(c.titres), textDecoration: 'underline' }}
            >
              <Zone nom={`nouvelles.${i}.appel.texte`} valeur={nouvelle.appel.texte} />
            </Link>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

function RuptureMissive({ rupture }: { rupture: ContenuMissive['rupture'] }) {
  const { couleurs: c } = useEncre();
  return (
    <Rupture>
      <Row>
        <Column className="pile" style={{ verticalAlign: 'middle' }}>
          <TitreRupture nom="rupture.titre" valeur={rupture.titre} taille={46} />
          <Text style={{ ...styleCorps(c.texte), fontSize: '16px', lineHeight: '26px' }}>
            <Zone nom="rupture.texte" valeur={rupture.texte} />
          </Text>
          <Appel nom="rupture.appel" appel={rupture.appel} couleur={c.titresRupture} />
        </Column>
        {rupture.photo && (
          <Column className="pile" width="204" style={{ verticalAlign: 'middle', paddingLeft: '24px' }}>
            <Photo src={rupture.photo} zone="rupture.photo" largeur={180} degres={INCLINAISONS.rupture} />
          </Column>
        )}
      </Row>
    </Rupture>
  );
}
