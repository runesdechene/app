import sharp from 'sharp';
import { Image } from './image.js';
import { ImageBuilder } from './image-builder.js';

class Variant {
  constructor(
    public readonly variant: string,
    public readonly format: 'png' | 'webp',
    public readonly image: Image,
  ) {}
}

export class ImageCompressor {
  async compress(image: Image, options: Options) {
    const result = await Promise.all(
      options.variants.map((variant) => {
        return this.compressVariant(image, variant);
      }),
    );

    return {
      images: result,
    };
  }

  private async compressVariant(
    image: Image,
    variant: Option,
  ): Promise<Variant> {
    switch (variant.format) {
      case 'png':
        return this.compressPng(image, variant);
      case 'webp':
        return this.compressWebp(image, variant);
    }
  }

  private async compressPng(image: Image, option: Option): Promise<Variant> {
    const instance = sharp(image.props.buffer);

    const buffer = await instance
      .resize(this.shrinkedByLargestSide(image, option.side))
      .png()
      .toBuffer();

    const nextImage = await new ImageBuilder()
      .fromBuffer(buffer)
      .named(`${image.filename()}_${option.name}.png`)
      .build();

    return new Variant(option.name, 'png', nextImage);
  }

  private async compressWebp(image: Image, variant: Option): Promise<Variant> {
    const buffer = await sharp(image.props.buffer)
      .resize(this.shrinkedByLargestSide(image, variant.side))
      .webp()
      .toBuffer();

    const nextImage = await new ImageBuilder()
      .fromBuffer(buffer)
      .named(`${image.filename()}_${variant.name}.webp`)
      .build();

    return new Variant(variant.name, 'webp', nextImage);
  }

  private shrinkedByLargestSide(image: Image, maxValue: number) {
    const width = image.props.width;
    const height = image.props.height;

    let nextWidth: number, nextHeight: number;

    if (width > height) {
      const ratio = width / maxValue;
      nextWidth = maxValue;
      nextHeight = Math.floor(height / ratio);
    } else {
      const ratio = height / maxValue;
      nextHeight = maxValue;
      nextWidth = Math.floor(width / ratio);
    }

    return {
      height: nextHeight,
      width: nextWidth,
    };
  }
}

type Option = { name: string; side: number; format: 'png' | 'webp' };

export class OptionsBuilder {
  private variants: Option[] = [];

  png(name: string, side: number) {
    this.variants.push({ name, side, format: 'png' });
    return this;
  }

  webp(name: string, side: number) {
    this.variants.push({ name, side, format: 'webp' });
    return this;
  }

  build() {
    return new Options({ variants: this.variants });
  }
}

export class Options {
  public variants: Option[];

  constructor(data: { variants: Option[] }) {
    this.variants = data.variants;
  }
}
