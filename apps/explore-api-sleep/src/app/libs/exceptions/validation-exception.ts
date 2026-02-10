import z from 'zod';

type ValidationExceptionPayload = {
  errors: ValidationError[];
};

type ValidationError = {
  message: string;
  path: (string | number)[];
};

export class ValidationException extends Error {
  static fromZod(zodError: z.ZodError) {
    return new ValidationException({
      errors: zodError.errors.map((error) => {
        return {
          message: error.message,
          path: error.path,
        };
      }),
    });
  }

  constructor(public readonly errors: ValidationExceptionPayload) {
    super('Validation Exception');
  }
}
