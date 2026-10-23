// Le Fragment : un nouveau dessin, son histoire et les pièces qui le portent (maquette Figma 743:2464).

import { Column, Img, Link, Row, Section, Text } from '@react-email/components';
import { Cadre } from '../briques/Cadre';
import { ALEGREYA, styleCorps, styleRubrique, useEncre, Zone } from '../briques/encre';
import { EnTete, Planche } from '../briques/EnTete';
import { Lettrine } from '../briques/Lettrine';
import { Appel, Rupture, TitreRupture } from '../briques/Rupture';
import { Signature } from '../briques/Signature';
import type { ContenuFragment, ProprietesModele } from '../types';

export function Fragment({ contenu, couleurs, apercu, destinataire, edition }: ProprietesModele<ContenuFragment>) {
  return (
    <Cadre couleurs={couleurs} apercu={apercu} destinataire={destinataire} edition={edition} titres={contenu.titresEnImages}>
      <EnTete enTete={contenu.enTete} titre={contenu.titre} sousTitre={contenu.sousTitre} taille={176} />
      <Planche photo={contenu.photo} />
      <Lettrine ouverture={contenu.ouverture} corps={contenu.corps} />
      <Histoire histoire={contenu.histoire} />
      <PorterLeFragment rupture={contenu.rupture} />
      <Pieces contenu={contenu} />
      <Signature />
    </Cadre>
  );
}

function Histoire({ histoire }: { histoire: ContenuFragment['histoire'] }) {
  const { couleurs: c } = useEncre();
  return (
    <Section style={{ padding: '14px 48px 0' }}>
      <Link href={histoire.lien} data-zone="histoire.lien" style={{ ...styleRubrique(c.titres, 14), textDecoration: 'underline' }}>
        <Zone nom="histoire.texte" valeur={histoire.texte} />
      </Link>
    </Section>
  );
}

function PorterLeFragment({ rupture }: { rupture: ContenuFragment['rupture'] }) {
  const { couleurs: c } = useEncre();
  return (
    <Rupture style={{ padding: '48px 48px 40px', marginTop: '52px' }}>
      <TitreRupture nom="rupture.titre" valeur={rupture.titre} taille={72} />
      <Text style={styleCorps(c.texte)}>
        <Zone nom="rupture.texte" valeur={rupture.texte} />
      </Text>
    </Rupture>
  );
}

function Pieces({ contenu }: { contenu: ContenuFragment }) {
  const { couleurs: c } = useEncre();
  return (
    <Section style={{ padding: '36px 48px 0' }}>
      <Row>
        {contenu.pieces.map((piece, i) => (
          <Column key={i} className="pile" width="244" style={{ verticalAlign: 'top', paddingLeft: i === 0 ? 0 : '16px' }}>
            <Img src={piece.photo} alt={piece.nom} width="244" data-zone={`pieces.${i}.photo`} style={{ display: 'block', height: 'auto' }} />
            <Text style={{ fontFamily: ALEGREYA, fontWeight: 500, fontSize: '15px', color: c.texte, margin: '10px 0 0' }}>
              <Zone nom={`pieces.${i}.nom`} valeur={piece.nom} />
              {' · '}
              <span style={{ fontWeight: 400, color: c.titres }}>
                <Zone nom={`pieces.${i}.prix`} valeur={piece.prix} />
              </span>
            </Text>
          </Column>
        ))}
      </Row>
      <Text style={{ ...styleCorps(c.texte), fontSize: '15px', lineHeight: '24px', marginTop: '22px' }}>
        <Zone nom="autresCoupes" valeur={contenu.autresCoupes} />
      </Text>
      <Appel nom="appel" appel={contenu.appel} couleur={c.titres} />
    </Section>
  );
}
