import { CommandHandler, ICommand, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';

import {
  I_IMAGE_MEDIA_REPOSITORY,
  IImageMediaRepository,
} from '../../ports/repositories/image-media-repository.js';
import { I_STORAGE, IStorage } from '../../ports/services/storage.interface.js';
import { BadRequestException } from '../../../libs/exceptions/bad-request-exception.js';
import {
  Cache,
  Storable,
  StorageType,
} from '../../../libs/storage/storable.js';
import { ImageBuilder } from '../../../libs/media/image-builder.js';
import {
  ImageCompressor,
  OptionsBuilder,
} from '../../../libs/media/image-compressor.js';
import { VariantNameType } from '../../../domain/entities/image-media.js';

export class CompressImageCommand implements ICommand {
  constructor(public readonly imageId: string) {}
}

export type CompressImageResult = void;

@CommandHandler(CompressImageCommand)
export class CompressImageCommandHandler implements ICommandHandler {
  constructor(
    @Inject(I_IMAGE_MEDIA_REPOSITORY)
    private readonly imageMediaRepository: IImageMediaRepository,
    @Inject(I_STORAGE) private readonly storage: IStorage,
  ) {}

  async execute({
    imageId,
  }: CompressImageCommand): Promise<CompressImageResult> {
    const imageMediaQuery = await this.imageMediaRepository.byId(imageId);
    const imageMedia = imageMediaQuery.getOrThrow();

    const url = imageMedia.findUrl(['original']);
    if (!url) {
      throw new BadRequestException({
        code: 'IMAGE_MEDIA_NOT_FOUND',
        message: 'Image media not found',
      });
    }

    const path = new URL(url).pathname.slice(1);
    const loaded = await this.storage.load(path, StorageType.ASSETS);
    const image = await new ImageBuilder()
      .fromBuffer(loaded.props.body as Buffer)
      .named(loaded.props.key)
      .build();

    const compressor = new ImageCompressor();
    const options = new OptionsBuilder()
      .png('small', 300)
      .png('medium', 800)
      .png('scrapping', 1200)
      .png('large', 1600)
      .webp('small', 300)
      .webp('medium', 800)
      .webp('large', 1600)
      .build();

    const { images } = await compressor.compress(image, options);

    await Promise.all(
      images.map(async ({ format, variant, image }) => {
        const variantNameStr = `${format}_${variant}` as VariantNameType;

        const storable = new Storable({
          key: `${image.filename()}.${image.extension()}`,
          body: image.props.buffer,
          contentType: image.contentType(),
          cache: Cache.ONE_YEAR,
          storageType: StorageType.ASSETS,
        });

        const stored = await this.storage.store(storable);
        imageMedia.variants.push({
          name: variantNameStr,
          url: stored.props.url!,
          width: image.props.width,
          height: image.props.height,
          size: image.props.weight.toInt(),
        });
      }),
    );

    await this.imageMediaRepository.save(imageMedia);
  }
}
