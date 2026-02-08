import { CommandHandler, ICommand, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
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

export class StoreAsUrlCommand implements ICommand {
  constructor(
    public readonly image: Image,
    public readonly auth: AuthContext,
  ) {}
}

export type Result = { url: string };

@CommandHandler(StoreAsUrlCommand)
export class StoreAsUrlCommandHandler
  implements ICommandHandler<StoreAsUrlCommand, Result>
{
  constructor(
    @Inject(I_ID_PROVIDER) private readonly idProvider: IIdProvider,
    @Inject(I_STORAGE) private readonly storage: IStorage,
  ) {}

  async execute({ image, auth }: StoreAsUrlCommand): Promise<Result> {
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

    const result = await this.storage.store(storable);

    return {
      url: result.props.url!,
    };
  }
}
