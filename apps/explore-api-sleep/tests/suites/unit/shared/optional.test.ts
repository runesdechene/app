import { Optional } from '../../../../src/app/libs/shared/optional.js';

describe('Optional', () => {
  test('a null optional should not be present', () => {
    const optional = Optional.of(null);
    expect(optional.isPresent()).toBe(false);
  });

  test('an undefined optional should not be present', () => {
    const optional = Optional.of(undefined);
    expect(optional.isPresent()).toBe(false);
  });

  test('any non-null value should not be present', () => {
    const optional = Optional.of('test');
    expect(optional.isPresent()).toBe(true);
  });

  describe('getting or throwing', () => {
    test('when the value is present, should return it', () => {
      const optional = Optional.of('test');
      const value = optional.getOrThrow();
      expect(value).toBe('test');
    });

    test('when the value is absent, should throw', () => {
      const optional = Optional.of(null);
      expect(() => {
        optional.getOrThrow();
      }).toThrow(new Error('value is not present'));
    });

    test('when the value is absent, should throw a custom error', () => {
      const optional = Optional.of(null);
      expect(() => {
        optional.getOrThrow(() => new Error('custom error'));
      }).toThrow(new Error('custom error'));
    });
  });

  describe('getting or null', () => {
    test('when the value is present, should return it', () => {
      const optional = Optional.of('test');
      const value = optional.getOrNull();
      expect(value).toBe('test');
    });

    test('when the value is absent, should return null', () => {
      const optional = Optional.of(null);
      const value = optional.getOrNull();
      expect(value).toBe(null);
    });
  });
});
