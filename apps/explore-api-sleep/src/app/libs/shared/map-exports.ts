import { Provider } from '@nestjs/common';

export const mapExports = (...providers: Array<Provider[]>) =>
  providers.flatMap((s) =>
    s
      .map((s: any) => {
        if (!s.provide) {
          return s;
        }

        return s.provide;
      })
      .filter((s) => s !== null),
  );
