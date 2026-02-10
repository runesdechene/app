import { Authorizer } from '../../../../../src/app/application/services/auth/authorizer/authorizer.js';
import { JwtService } from '../../../../../src/app/application/services/auth/jwt-service/jwt-service.js';
import { TestAuthConfig } from '../../../../../src/app/application/services/auth/auth-config/test-auth-config.js';
import { AccessTokenPayload } from '../../../../../src/app/domain/model/access-token.js';
import { addMinutes } from 'date-fns';
import { Role } from '../../../../../src/app/domain/model/role.js';
import { Rank } from '../../../../../src/app/domain/model/rank.js';
import { FixedDateProvider } from '../../../../../src/adapters/for-tests/services/fixed-date-provider.js';
import { BadAuthenticationException } from '../../../../../src/app/libs/exceptions/bad-authentication-exception.js';

const dateProvider = new FixedDateProvider();
const jwtService = new JwtService(new TestAuthConfig(), dateProvider);
const authorizer = new Authorizer(jwtService);

it('should authenticate a valid JWT', async () => {
  const token = await jwtService.sign<AccessTokenPayload>(
    {
      aud: 'api',
      sub: '123',
      emailAddress: 'johndoe@gmail.com',
      role: Role.USER,
      rank: Rank.GUEST,
      lastName: 'Doe',
    },
    {
      issuedAt: dateProvider.now(),
      expiresAt: addMinutes(dateProvider.now(), 15),
    },
  );

  const result = await authorizer.check(token.value());

  expect(result.id()).toBe('123');
  expect(result.emailAddress()).toBe('johndoe@gmail.com');
  expect(result.role()).toBe(Role.USER);
  expect(result.rank()).toBe(Rank.GUEST);
});

it('should reject an invalid JWT', async () => {
  await expect(() => authorizer.check('a random value')).rejects.toThrow(
    new BadAuthenticationException('Invalid access token'),
  );
});
