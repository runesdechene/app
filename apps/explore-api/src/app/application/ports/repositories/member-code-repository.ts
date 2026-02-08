import { Optional } from '../../../libs/shared/optional.js';
import { MemberCode } from '../../../domain/entities/member-code.js';

export const I_MEMBER_CODE_REPOSITORY = Symbol('I_MEMBER_CODE_REPOSITORY');

export interface IMemberCodeRepository {
  byId(id: string): Promise<Optional<MemberCode>>;

  byCode(code: string): Promise<Optional<MemberCode>>;

  save(user: MemberCode): Promise<void>;

  delete(user: MemberCode): Promise<void>;

  clear(): Promise<void>;
}
