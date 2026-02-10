import { Bytes } from '../shared/bytes.js';

export type SupportedFormat = 'png' | 'webp' | 'jpeg';

export class Image {
  constructor(
    public readonly props: {
      buffer: Buffer;
      name: string;
      width: number;
      height: number;
      weight: Bytes;
      format: SupportedFormat;
    },
  ) {}

  filename() {
    const parts = this.props.name.split('.');
    return parts.length === 0 ? this.props.name : parts[0];
  }

  extension() {
    return this.props.format;
  }

  contentType() {
    switch (this.props.format) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'jpeg':
        return 'image/jpeg';
    }
  }
}
