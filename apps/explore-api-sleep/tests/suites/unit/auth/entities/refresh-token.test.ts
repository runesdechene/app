import { RefreshTokenBuilder } from '../../../../../src/app/domain/builders/refresh-token-builder.js';
import { FixedDateProvider } from '../../../../../src/adapters/for-tests/services/fixed-date-provider.js';

const dateProvider = new FixedDateProvider(
  new Date('2024-01-01T01:00:00.000Z'),
);

describe('expiration', () => {
  const createToken = (expiresAt: Date) =>
    new RefreshTokenBuilder().expiresAt(expiresAt).build();

  it('has not expired if the date is in the future', () => {
    const refreshToken = createToken(new Date('2024-01-02T00:00:00.000Z'));
    expect(refreshToken.hasExpired(dateProvider)).toBe(false);
  });

  it('has not expired if the date is in the past', () => {
    const refreshToken = createToken(new Date('2024-01-01T00:00:00.000Z'));
    expect(refreshToken.hasExpired(dateProvider)).toBe(true);
  });
});
