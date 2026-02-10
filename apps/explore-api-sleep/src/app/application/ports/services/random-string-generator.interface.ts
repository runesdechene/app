export const I_RANDOM_STRING_GENERATOR = Symbol('I_RANDOM_STRING_GENERATOR');

export interface IRandomStringGenerator {
  generate(): Promise<string>;
}
