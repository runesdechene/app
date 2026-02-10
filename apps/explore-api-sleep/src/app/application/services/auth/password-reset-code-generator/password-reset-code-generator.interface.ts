export const I_PASSWORD_RESET_CODE_GENERATOR = Symbol(
  'I_PASSWORD_RESET_CODE_GENERATOR',
);

export interface IPassworResetCodeGenerator {
  generate(): string;
}
