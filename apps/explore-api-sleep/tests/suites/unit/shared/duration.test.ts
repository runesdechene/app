import { Duration } from '../../../../src/app/libs/shared/duration.js';

test('factories', () => {
  expect(Duration.fromMinutes(1).toSeconds()).toBe(60);
  expect(Duration.fromHours(1).toSeconds()).toBe(3600);
  expect(Duration.fromDays(1).toSeconds()).toBe(86400);
  expect(Duration.fromMilliseconds(1000).toSeconds()).toBe(1);
  expect(Duration.fromSeconds(1).toSeconds()).toBe(1);

  expect(Duration.fromSeconds(1).toMilliseconds()).toBe(1000);
});

test('equality', () => {
  expect(Duration.fromSeconds(1).equals(Duration.fromSeconds(1))).toBe(true);
  expect(Duration.fromSeconds(1).equals(Duration.fromSeconds(2))).toBe(false);
});
