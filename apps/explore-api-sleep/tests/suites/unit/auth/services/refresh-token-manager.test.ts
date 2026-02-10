import { RefreshTokenManager } from '../../../../../src/app/application/services/auth/refresh-token-manager/refresh-token-manager.js';
import { UserBuilder } from '../../../../../src/app/domain/builders/user-builder.js';
import { RamRefreshTokenRepository } from '../../../../../src/adapters/for-tests/database/repositories/ram-refresh-token-repository.js';
import { TestAuthConfig } from '../../../../../src/app/application/services/auth/auth-config/test-auth-config.js';
import { FixedIDProvider } from '../../../../../src/adapters/for-tests/services/fixed-id-provider.js';
import { FixedDateProvider } from '../../../../../src/adapters/for-tests/services/fixed-date-provider.js';
import { FixedRandomStringGenerator } from '../../../../../src/adapters/for-tests/services/fixed-random-string-generator.js';

describe('Feature: creating refresh tokens', () => {
  const user = new UserBuilder().build();

  const idProvider = new FixedIDProvider();
  const dateProvider = new FixedDateProvider();
  const randomStringGenerator = new FixedRandomStringGenerator();
  const refreshTokenRepository = new RamRefreshTokenRepository();
  const authConfig = new TestAuthConfig();

  const sut = new RefreshTokenManager(
    idProvider,
    dateProvider,
    randomStringGenerator,
    refreshTokenRepository,
    authConfig,
  );

  beforeEach(() => {
    refreshTokenRepository.clearSync();
  });

  it('should return a new refresh token', async () => {
    const result = await sut.create(user);

    expect(result.id).toBe(idProvider.ID);
    expect(result.user.id).toBe(user.id);
    expect(result.value).toBe(randomStringGenerator.VALUE);
    expect(result.createdAt).toEqual(dateProvider.now());
    expect(result.expiresAt).toEqual(
      authConfig.getRefreshTokenLifetime().addToDate(dateProvider.now()),
    );
    expect(result.disabled).toBe(false);
  });

  it('should save the refresh token', async () => {
    const result = await sut.create(user);
    const refreshToken = await refreshTokenRepository.byId(result.id);

    expect(refreshToken.isPresent()).toBe(true);
    expect(refreshToken.getOrThrow()).toEqual(result);
  });
});
