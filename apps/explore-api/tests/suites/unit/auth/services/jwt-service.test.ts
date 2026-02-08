import { addHours } from 'date-fns';
import { JwtService } from '../../../../../src/app/application/services/auth/jwt-service/jwt-service.js';
import { TestAuthConfig } from '../../../../../src/app/application/services/auth/auth-config/test-auth-config.js';
import { AuthConfig } from '../../../../../src/app/application/services/auth/auth-config/auth-config.js';
import { Duration } from '../../../../../src/app/libs/shared/duration.js';
import { FixedDateProvider } from '../../../../../src/adapters/for-tests/services/fixed-date-provider.js';
import { BadRequestException } from '../../../../../src/app/libs/exceptions/bad-request-exception.js';

describe('Class: jwt-service', () => {
  const dateProvider = new FixedDateProvider();
  let sut: JwtService;

  beforeEach(() => {
    sut = new JwtService(new TestAuthConfig(), dateProvider);
  });

  test('signing and decoding a JWT', async () => {
    const payload = {
      userId: '123',
      name: 'JohnDoe',
      accountNumber: 123,
      isAdmin: true,
      aud: ['api'],
    };

    const issuedAt = dateProvider.now();
    const expiresAt = addHours(issuedAt, 1);

    const encoded = await sut.sign(payload, {
      issuedAt,
      expiresAt,
    });

    const decoded = await sut.decode(encoded.value());

    expect(decoded).toEqual({
      userId: '123',
      name: 'JohnDoe',
      accountNumber: 123,
      isAdmin: true,
      aud: ['api'],
      iat: Math.floor(issuedAt.getTime() / 1000),
      nbf: expect.any(Number),
      exp: Math.floor(expiresAt.getTime() / 1000),
    });
  });

  describe('Audience', () => {
    async function createJWT() {
      const payload = {
        userId: '123',
        name: 'JohnDoe',
        accountNumber: 123,
        isAdmin: true,
        aud: ['api'],
      };

      const issuedAt = dateProvider.now();
      const expiresAt = addHours(issuedAt, 1);

      return sut.sign(payload, {
        issuedAt,
        expiresAt,
      });
    }

    test('Decoding a JWT with a valid audience', async () => {
      const token = await createJWT();
      const decoded = await sut.decode(token.value(), {
        aud: ['api'],
      });

      expect(decoded).toEqual({
        userId: '123',
        name: 'JohnDoe',
        accountNumber: 123,
        isAdmin: true,
        aud: ['api'],
        iat: Math.floor(token.issuedAt().getTime() / 1000),
        nbf: expect.any(Number),
        exp: Math.floor(token.expiresAt().getTime() / 1000),
      });
    });

    test('Decoding a JWT with an invalid audience', async () => {
      const token = await createJWT();
      await expect(() =>
        sut.decode(token.value(), {
          aud: ['edlt'],
        }),
      ).rejects.toThrow();
    });
  });

  test('decoding a JWT signed with another key', async () => {
    const deceivingJWTService = new JwtService(
      new AuthConfig({
        refreshTokenLifetime: Duration.fromSeconds(60),
        accessTokenLifetime: Duration.fromSeconds(60),
        accessTokenSecret: 'other-key',
      }),
      dateProvider,
    );

    const payload = {
      userId: '123',
      name: 'JohnDoe',
      accountNumber: 123,
      isAdmin: true,
    };

    const issuedAt = dateProvider.now();
    const expiresAt = addHours(issuedAt, 1);

    const token = await deceivingJWTService.sign(payload, {
      issuedAt,
      expiresAt,
    });

    await expect(() => sut.decode(token.value())).rejects.toThrowError(
      new BadRequestException({
        code: 'JWT_SIGNATURE_VERIFICATION_FAILED',
        message: 'signature verification failed',
      }),
    );
  });
});
