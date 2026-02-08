import { Image } from './image.js';
import { Nullable } from '../shared/types.js';
import { Bytes } from '../shared/bytes.js';
import { ValidationException } from '../exceptions/validation-exception.js';

export class ImageValidator {
  constructor(
    private readonly maxWeight: Nullable<Bytes>,
    private readonly maxWidth: Nullable<number>,
    private readonly maxHeight: Nullable<number>,
  ) {}

  validate(image: Image) {
    const errors: any[] = [];
    if (
      this.maxWeight !== null &&
      image.props.weight.isGreaterThan(this.maxWeight)
    ) {
      errors.push([
        {
          message: `Image weight must be less than ${this.maxWeight.toKilobytes()} KB`,
          path: ['weight'],
        },
      ]);
    }

    if (this.maxWidth !== null && image.props.width > this.maxWidth) {
      errors.push([
        {
          message: `Image width must be less than ${this.maxWidth}`,
          path: ['width'],
        },
      ]);
    }

    if (this.maxHeight !== null && image.props.height > this.maxHeight) {
      errors.push([
        {
          message: `Image height must be less than ${this.maxHeight}`,
          path: ['height'],
        },
      ]);
    }

    if (errors.length > 0) {
      throw new ValidationException({ errors });
    }
  }
}

export class ImageValidatorBuilder {
  static create() {
    return new ImageValidatorBuilder();
  }

  private maxWeight: Nullable<Bytes> = null;
  private maxWidth: Nullable<number> = null;
  private maxHeight: Nullable<number> = null;

  withMaxWeight(maxWeight: Bytes) {
    this.maxWeight = maxWeight;
    return this;
  }

  withMaxDimension(dimension: number) {
    this.maxWidth = dimension;
    this.maxHeight = dimension;
    return this;
  }

  build() {
    return new ImageValidator(this.maxWeight, this.maxWidth, this.maxHeight);
  }
}
