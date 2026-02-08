import { InHouseTranslator } from '../../../../src/app/libs/i18n/in-house-translator.js';

describe('Class: InHouseTranslator', () => {
  const translator = new InHouseTranslator({
    ['fr']: {
      hello: 'Bonjour',
      'hello-name': 'Bonjour {name}',
    },
  } as any);

  it('should translate keys', () => {
    expect(translator.translate('hello' as any, 'fr')).toBe('Bonjour');
    expect(
      translator.translate('hello-name' as any, 'fr', { name: 'John' }),
    ).toBe('Bonjour John');
  });
});
