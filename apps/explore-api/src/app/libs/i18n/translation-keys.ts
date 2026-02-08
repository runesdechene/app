import { authI18n, AuthI18N } from '../../application/i18n/auth-i18n.js';
import deepMerge from 'deepmerge';

export type TranslationKeys = AuthI18N;

export const allTranslationKeys = [authI18n].reduce(
  (acc, curr) => deepMerge(acc, curr),
  {},
);
