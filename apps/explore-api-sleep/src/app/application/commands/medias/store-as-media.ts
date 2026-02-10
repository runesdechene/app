import { CommandHandler, ICommand, ICommandHandler } from '@nestjs/cqrs';
import {
  I_IMAGE_COMPRESSING_QUEUE,
  IImageCompressingQueue,
} from '../../ports/queues/image-compressing-queue.js';
import {
  I_IMAGE_MEDIA_REPOSITORY,
  IImageMediaRepository,
} from '../../ports/repositories/image-media-repository.js';
import { Image } from '../../../libs/media/image.js';
import { AuthContext } from '../../../domain/model/auth-context.js';
import {
  I_ID_PROVIDER,
  IIdProvider,
} from '../../ports/services/id-provider.interface.js';
import { I_STORAGE, IStorage } from '../../ports/services/storage.interface.js';
import { ImageValidatorBuilder } from '../../../libs/media/image-validator.js';
import { Bytes } from '../../../libs/shared/bytes.js';
import {
  Cache,
  Storable,
  StorageType,
} from '../../../libs/storage/storable.js';
import { Inject } from '@nestjs/common';
import { ImageMedia } from '../../../domain/entities/image-media.js';
import { ref } from '@mikro-orm/core';
import { User } from '../../../domain/entities/user.js';

export class StoreAsMediaCommand implements ICommand {
  constructor(
    public readonly image: Image,
    public readonly auth: AuthContext,
  ) {}
}

export type SaveImageResult = { id: string; url: string };

@CommandHandler(StoreAsMediaCommand)
export class StoreAsMediaCommandHandler
  implements ICommandHandler<StoreAsMediaCommand, SaveImageResult>
{
  constructor(
    @Inject(I_ID_PROVIDER) private readonly idProvider: IIdProvider,
    @Inject(I_IMAGE_MEDIA_REPOSITORY)
    private readonly imageMediaRepository: IImageMediaRepository,
    @Inject(I_STORAGE) private readonly storage: IStorage,
    @Inject(I_IMAGE_COMPRESSING_QUEUE)
    private readonly imageCompressingQueue: IImageCompressingQueue,
  ) {}

  async execute({
    image,
    auth,
  }: StoreAsMediaCommand): Promise<SaveImageResult> {
    const validator = new ImageValidatorBuilder()
      .withMaxWeight(Bytes.megabytes(10))
      .withMaxDimension(5000)
      .build();

    validator.validate(image);

    const storable = new Storable({
      key: `u/${auth.id()}/${this.idProvider.getId()}.${image.extension()}`,
      body: image.props.buffer,
      contentType: image.contentType(),
      cache: Cache.ONE_YEAR,
      storageType: StorageType.ASSETS,
    });

    const stored = await this.storage.store(storable);

    const imageMedia = new ImageMedia();
    imageMedia.id = this.idProvider.getId();
    imageMedia.user = ref(User, auth.id());
    imageMedia.variants = [
      {
        name: 'original',
        url: stored.props.url!,
        width: image.props.width,
        height: image.props.height,
        size: image.props.weight.toInt(),
      },
    ];

    await this.imageMediaRepository.save(imageMedia);
    await this.imageCompressingQueue.enqueue(imageMedia.id);

    return {
      id: imageMedia.id,
      url: stored.props.url!,
    };
  }
}
