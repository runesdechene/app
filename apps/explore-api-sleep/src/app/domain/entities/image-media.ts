import { Entity, ManyToOne, Property, Ref } from '@mikro-orm/core';
import { User } from './user.js';
import { Nullable } from '../../libs/shared/types.js';
import { SqlEntity } from '../../../adapters/for-production/database/sql-entity.js';

export const availableVariants = [
  'original',
  'webp_small',
  'webp_medium',
  'webp_large',
  'png_small',
  'png_medium',
  'png_large',
  'png_scrapping',
] as const;

export type VariantNameType = (typeof availableVariants)[number];

export type SerializedVariant = {
  name: VariantNameType;
  url: string;
  height: number;
  width: number;
  size: number;
};

type Props = {
  id: string;
  user: Ref<User>;
  variants: SerializedVariant[];
};

@Entity({ tableName: 'image_media' })
export class ImageMedia extends SqlEntity<Props> {
  @Property({ primary: true })
  id: string;

  @ManyToOne({
    entity: () => User,
    index: true,
    ref: true,
    deleteRule: 'cascade',
  })
  user!: Ref<User>;

  @Property({ type: 'json' })
  variants: SerializedVariant[];

  findVariantMatching(names: VariantNameType[]): Nullable<SerializedVariant> {
    for (const name of names) {
      const variant = this.variants.find((v) => v.name === name);
      if (variant) {
        return variant;
      }
    }

    return null;
  }

  findUrl(names: VariantNameType[]): Nullable<string> {
    for (const name of names) {
      const variant = this.variants.find((v) => v.name === name);
      if (variant) {
        return variant.url;
      }
    }

    return null;
  }
}
