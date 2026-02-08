import { TranslationKeys } from './translation-keys.js';
import { Lang } from './lang.js';

export const I_TRANSLATOR = Symbol('I_TRANSLATOR');

export interface ITranslator {
  translate(
    key: TranslationKeys,
    lang: Lang,
    params?: Record<string, string>,
  ): string;
}
