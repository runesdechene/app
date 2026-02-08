import { IFixture } from '../config/fixture.interface.js';
import { ITester } from '../config/tester.interface.js';
import {
  I_MEMBER_CODE_REPOSITORY,
  IMemberCodeRepository,
} from '../../src/app/application/ports/repositories/member-code-repository.js';
import { MemberCode } from '../../src/app/domain/entities/member-code.js';

export class MemberCodeFixture implements IFixture {
  constructor(private readonly entity: MemberCode) {}

  async load(tester: ITester): Promise<void> {
    const repository = tester.get<IMemberCodeRepository>(
      I_MEMBER_CODE_REPOSITORY,
    );

    await repository.save(this.entity);
  }
}
