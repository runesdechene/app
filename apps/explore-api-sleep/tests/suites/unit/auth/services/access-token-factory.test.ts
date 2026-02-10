import { AccessTokenFactory } from '../../../../../src/app/application/services/auth/access-token-factory/access-token-factory.js';
import { UserBuilder } from '../../../../../src/app/domain/builders/user-builder.js';
import { JwtService } from '../../../../../src/app/application/services/auth/jwt-service/jwt-service.js';
import { Duration } from '../../../../../src/app/libs/shared/duration.js';
import { TestAuthConfig } from '../../../../../src/app/application/services/auth/auth-config/test-auth-config.js';
import { FixedDateProvider } from '../../../../../src/adapters/for-tests/services/fixed-date-provider.js';

const user = new UserBuilder()
  .id('user-1')
  .emailAddress('johndoe@gmail.com')
  .lastName('Doe')
  .build();

const dateProvider = new FixedDateProvider();
const authConfig = new TestAuthConfig();
const jwtService = new JwtService(authConfig, dateProvider);
const factory = new AccessTokenFactory(jwtService, dateProvider, authConfig);

test('a valid JWT must be provided', async () => {
  const token = await factory.create(user);
  const decoded = await jwtService.decode(token.value());

  expect(decoded.aud).toBe('api');
  expect(decoded.exp).toBe(token.expiresAt().getTime() / 1000);
  expect(decoded.iat).toBe(token.issuedAt().getTime() / 1000);
  expect(decoded.sub).toBe('user-1');
  expect(decoded.emailAddress).toBe('johndoe@gmail.com');
  expect(decoded.role).toBe('user');
  expect(decoded.rank).toBe('guest');
  expect(decoded.lastName).toBe('Doe');
});

test('the access token should live for one hour', async () => {
  const token = await factory.create(user);

  const difference = Duration.fromMilliseconds(
    token.expiresAt().getTime() - token.issuedAt().getTime(),
  );

  expect(difference.equals(authConfig.getAccessTokenLifetime())).toBe(true);
});
