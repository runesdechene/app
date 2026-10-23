// Une photo de la lettre. Dans l'e-mail, elle part telle quelle (déjà penchée par le Hub, voir photos.ts) ;
// dans l'éditeur du Hub, elle penche à l'écran, et ses coins prennent les couleurs du moment.

import { Img } from '@react-email/components';
import type { CSSProperties } from 'react';
import { useEncre } from './encre';

type Props = { src: string; zone: string; largeur: number; degres: number; alt?: string; style?: CSSProperties };

export function Photo({ src, zone, largeur, degres, alt = '', style }: Props) {
  const { edition } = useEncre();
  const image = <Img src={src} alt={alt} width={String(largeur)} data-zone={zone} style={{ display: 'block', height: 'auto', ...style }} />;
  if (!edition || degres === 0) return image;
  return (
    // Comme le dessin du Hub : un peu plus large que le cadre, penché, les bords coupés.
    <div style={{ overflow: 'hidden', padding: `${String(Math.abs(degres) * 1.2)}% 0` }}>
      <div style={{ transform: `rotate(${String(degres)}deg) scale(${largeur >= 600 ? '1.13' : '1'})` }}>{image}</div>
    </div>
  );
}
