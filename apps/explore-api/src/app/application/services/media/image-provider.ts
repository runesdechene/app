import {
  BadRequestException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { fileTypeFromBuffer } from 'file-type';
import { Bytes } from '../../../libs/shared/bytes.js';
import { ImageBuilder } from '../../../libs/media/image-builder.js';

type Options = {
  fieldName: string;
};

export class ImageProvider {
  static async fromFastifyRequest(request: FastifyRequest, options: Options) {
    if (!request.isMultipart()) {
      return null;
    }

    const file = (await request.file({
      limits: {
        fileSize: Bytes.megabytes(10).toInt(),
      },
    }))!;

    if (file.fieldname !== options.fieldName) {
      throw new BadRequestException();
    }

    const buffer = await file.toBuffer();
    const fileType = (await fileTypeFromBuffer(buffer))!;

    const supportedMimeTypes = [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
    ];

    if (!supportedMimeTypes.includes(fileType.mime)) {
      throw new UnsupportedMediaTypeException({
        supported: supportedMimeTypes,
      });
    }

    return new ImageBuilder().named(file.filename).fromBuffer(buffer).build();
  }
}
