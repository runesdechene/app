// Le Carnet de route : nouvelles du stand nomade et prochaines haltes (maquette Figma 745:2464).

import { Column, Link, Row, Section, Text } from '@react-email/components';
import { Cadre } from '../briques/Cadre';
import { Photo } from '../briques/Photo';
import { INCLINAISONS } from '../photos';
import { ALEGREYA, BEBAS, EnImage, styleCorps, styleRubrique, useEncre, Zone } from '../briques/encre';
import { EnTete, Planche } from '../briques/EnTete';
import { Lettrine } from '../briques/Lettrine';
import { Appel, Rupture, TitreRupture } from '../briques/Rupture';
import { Signature } from '../briques/Signature';
import type { ContenuCarnet, ProprietesModele } from '../types';

export function Carnet({ contenu, couleurs, apercu, destinataire, edition }: ProprietesModele<ContenuCarnet>) {
  return (
    <Cadre couleurs={couleurs} apercu={apercu} destinataire={destinataire} edition={edition} titres={contenu.titresEnImages}>
      <EnTete enTete={contenu.enTete} titre={contenu.titre} sousTitre={contenu.sousTitre} taille={116} />
      <Planche photo={contenu.photo} />
      <Lettrine ouverture={contenu.ouverture} corps={contenu.corps} />
      <Tirages tirages={contenu.tirages} />
      <Haltes rupture={contenu.rupture} />
      <Signature salut={contenu.salut} />
    </Cadre>
  );
}

/** Deux tirages côte à côte, déjà penchés par le Hub ; le second un peu plus bas, comme posés sur la table. */
function Tirages({ tirages }: { tirages: ContenuCarnet['tirages'] }) {
  const { couleurs: c } = useEncre();
  return (
    <Section style={{ padding: '36px 44px 0' }}>
      <Row>
        <Column className="pile" width="256" style={{ verticalAlign: 'top' }}>
          <Photo src={tirages.gauche} zone="tirages.gauche" largeur={256} degres={INCLINAISONS.tirageGauche} />
        </Column>
        <Column className="pile" width="256" style={{ verticalAlign: 'top', paddingTop: '34px' }}>
          <Photo src={tirages.droite} zone="tirages.droite" largeur={256} degres={INCLINAISONS.tirageDroite} />
        </Column>
      </Row>
      <Text style={{ ...styleRubrique(c.rubriques, 11), padding: '8px 4px 0' }}>
        <Zone nom="tirages.legende" valeur={tirages.legende} />
      </Text>
    </Section>
  );
}

function Haltes({ rupture }: { rupture: ContenuCarnet['rupture'] }) {
  const { couleurs: c } = useEncre();
  return (
    <Rupture style={{ padding: '48px', marginTop: '52px' }}>
      <TitreRupture nom="rupture.titre" valeur={rupture.titre} taille={64} />
      <Text style={{ ...styleCorps(c.texte), marginBottom: '20px' }}>
        <Zone nom="rupture.texte" valeur={rupture.texte} />
      </Text>
      {rupture.haltes.map((halte, i) => (
        <Row key={i} style={{ borderTop: `1px solid ${c.titresRupture}` }}>
          <Column width="128" style={{ padding: '13px 0', fontFamily: BEBAS, fontSize: '26px', lineHeight: '26px', color: c.titresRupture }}>
            <EnImage zone={`rupture.haltes.${String(i)}.date`} texte={halte.date}>
              <Zone nom={`rupture.haltes.${i}.date`} valeur={halte.date} />
            </EnImage>
          </Column>
          <Column style={{ padding: '13px 0', fontFamily: ALEGREYA, fontSize: '18px', color: c.texte }}>
            <Zone nom={`rupture.haltes.${i}.lieu`} valeur={halte.lieu} />
          </Column>
          <Column width="24" align="right" style={{ padding: '13px 0' }}>
            <Link
              href={halte.lien}
              data-zone={`rupture.haltes.${i}.lien`}
              style={{ fontFamily: ALEGREYA, fontSize: '18px', color: c.titresRupture, textDecoration: 'none' }}
            >
              →
            </Link>
          </Column>
        </Row>
      ))}
      <Appel nom="rupture.appel" appel={rupture.appel} couleur={c.titresRupture} />
    </Rupture>
  );
}
