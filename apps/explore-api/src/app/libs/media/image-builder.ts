import sharp from 'sharp';
import { Image, SupportedFormat } from './image.js';
import { Bytes } from '../shared/bytes.js';

export class ImageBuilder {
  private buffer: Buffer;
  private name: string;

  fromBuffer(buffer: Buffer) {
    this.buffer = buffer;
    return this;
  }

  named(name: string) {
    this.name = name;
    return this;
  }

  async build() {
    const instance = sharp(this.buffer);
    const metadata = await instance.metadata();

    return new Image({
      buffer: this.buffer,
      name: this.name,
      width: metadata.width!,
      height: metadata.height!,
      weight: new Bytes(metadata.size!),
      format: metadata.format as SupportedFormat,
    });
  }
}
