import { ITranslator } from './translator.js';
import { Lang } from './lang.js';
import { TranslationKeys } from './translation-keys.js';
import { PartialRecord } from '../shared/types.js';

export class InHouseTranslator implements ITranslator {
  constructor(
    private readonly translations: PartialRecord<
      Lang,
      PartialRecord<TranslationKeys, string>
    > = {},
  ) {}

  translate(
    key: TranslationKeys,
    lang: Lang,
    params?: Record<string, string>,
  ): string {
    const translation = this.translations[lang]![key];
    if (!translation) {
      return key;
    }

    return params ? this.replaceParams(translation, params) : translation;
  }

  private replaceParams(translation: string, params: Record<string, string>) {
    return Object.entries(params).reduce(
      (acc, [key, value]) => acc.replace(`{${key}}`, value),
      translation,
    );
  }
}
