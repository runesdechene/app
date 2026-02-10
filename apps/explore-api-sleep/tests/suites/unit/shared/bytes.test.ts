import { expect, it } from 'vitest';
import { Bytes } from '../../../../src/app/libs/shared/bytes.js';

it('should compute the correct value in bytes', () => {
  expect(new Bytes(1).toInt()).toBe(1);
  expect(new Bytes(1000).toKilobytes()).toBe(1);
  expect(new Bytes(1000000).toMegabytes()).toBe(1);
  expect(new Bytes(1000000000).toGigabytes()).toBe(1);
  expect(Bytes.kilobytes(1).toInt()).toBe(1000);
  expect(Bytes.megabytes(1).toInt()).toBe(1000000);
  expect(Bytes.gigabytes(1).toInt()).toBe(1000000000);

  expect(new Bytes(1).equals(new Bytes(1))).toBe(true);
  expect(new Bytes(1).equals(new Bytes(2))).toBe(false);

  expect(new Bytes(1).isGreaterThan(new Bytes(1))).toBe(false);
  expect(new Bytes(2).isGreaterThan(new Bytes(1))).toBe(true);

  expect(new Bytes(1).isGreaterOrEqualThan(new Bytes(1))).toBe(true);
  expect(new Bytes(2).isGreaterOrEqualThan(new Bytes(1))).toBe(true);

  expect(new Bytes(1).isLessThan(new Bytes(1))).toBe(false);
  expect(new Bytes(1).isLessThan(new Bytes(2))).toBe(true);

  expect(new Bytes(1).isLessOrEqualThan(new Bytes(1))).toBe(true);
  expect(new Bytes(1).isLessOrEqualThan(new Bytes(2))).toBe(true);

  expect(new Bytes(1).add(new Bytes(1)).toInt()).toBe(2);
  expect(new Bytes(2).subtract(new Bytes(1)).toInt()).toBe(1);
});
