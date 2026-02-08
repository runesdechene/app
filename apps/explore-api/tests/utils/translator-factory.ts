import { allTranslationKeys } from '../../src/app/libs/i18n/translation-keys.js';
import { InHouseTranslator } from '../../src/app/libs/i18n/in-house-translator.js';

export class TranslatorFactory {
  static create() {
    return new InHouseTranslator(allTranslationKeys);
  }
}
