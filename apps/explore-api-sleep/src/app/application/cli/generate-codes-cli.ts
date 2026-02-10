import { Command, CommandRunner } from 'nest-commander';
import { Inject } from '@nestjs/common';
import { convertArrayToCSV } from 'convert-array-to-csv';
import {
  I_MEMBER_CODE_REPOSITORY,
  IMemberCodeRepository,
} from '../ports/repositories/member-code-repository.js';
import { CreateRequestContext, EntityManager } from '@mikro-orm/postgresql';
import { getRootPath } from '../../libs/shared/get-root-path.js';
import path from 'path';
import fs from 'fs';
import { RandomIdProvider } from '../../../adapters/for-production/services/random-id-provider.js';
import { MemberCode } from '../../domain/entities/member-code.js';

@Command({
  name: 'generate-codes',
  description: 'Generate codes',
  arguments: '<quantity>',
})
export class GenerateCodesCLI extends CommandRunner {
  constructor(
    @Inject(I_MEMBER_CODE_REPOSITORY)
    private readonly memberCodeRepository: IMemberCodeRepository,
    @Inject(EntityManager)
    private readonly em: EntityManager,
  ) {
    super();
  }

  @CreateRequestContext()
  async run(passedParams: string[], options?: any) {
    const quantity = parseInt(passedParams[0]);

    const header = ['code'];
    const dataArrays = (await this.generateCodes(quantity)).map((code) => [
      code,
    ]);

    await this.em.flush();

    const content = convertArrayToCSV(dataArrays, {
      header,
    });

    const filepath = path.resolve(getRootPath(), 'codes.csv');
    fs.writeFileSync(filepath, content);
  }

  private async generateCodes(quantity: number) {
    const sample = '0123456789';
    const codes: string[] = [];
    const digits = 6;

    const used = new Set<string>();

    for (let i = 0; i < quantity * 10; i++) {
      codes.push(i.toString().padStart(digits, '0'));
    }

    let multiple = 237;

    (() => {
      while (multiple > 0 && used.size < quantity) {
        for (let i = 0; i < codes.length; i += multiple) {
          if (used.size >= quantity) {
            return;
          }

          const code = codes[i];
          if (!used.has(code)) {
            used.add(code);
          }
        }

        multiple = Math.max(1, multiple - 17);
      }
    })();

    const result = Array.from(used);

    // shuffle
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    await Promise.all(
      result.map((code) => {
        const memberCode = new MemberCode();
        memberCode.id = RandomIdProvider.getId();
        memberCode.code = code;
        memberCode.isConsumed = false;
        memberCode.user = null;

        return this.memberCodeRepository.save(memberCode);
      }),
    );

    return result;
  }
}
