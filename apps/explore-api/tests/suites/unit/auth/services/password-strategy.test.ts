import { Argon2Strategy } from '../../../../../src/app/application/services/auth/password-strategy/argon2-strategy.js';

describe.each([new Argon2Strategy()])('Password strategy', (strategy) => {
  test('hashing a password', async () => {
    const password = 'password';
    const hash = await strategy.hash(password);
    expect(hash).not.toBe(password);
  });

  test('verifying a password', async () => {
    const password = 'password';
    const hash = await strategy.hash(password);
    const isEquals = await strategy.equals(password, hash);
    expect(isEquals).toBe(true);
  });

  test('failing when the password is wrong', async () => {
    const password = 'password';
    const hash = await strategy.hash(password);
    const isEquals = await strategy.equals('wrong-password', hash);
    expect(isEquals).toBe(false);
  });
});
