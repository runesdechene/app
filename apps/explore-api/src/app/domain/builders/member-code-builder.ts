import { RandomIdProvider } from '../../../adapters/for-production/services/random-id-provider.js';
import { MemberCode } from '../entities/member-code.js';
import { ref } from '@mikro-orm/core';
import { User } from '../entities/user.js';

export class MemberCodeBuilder {
  private readonly _props: Partial<MemberCode>;

  constructor(props?: Partial<MemberCode>) {
    this._props = {
      id: RandomIdProvider.getId(),
      user: null,
      code: 'azerty',
      isConsumed: false,
      ...props,
    };
  }

  id(id: string) {
    this._props.id = id;
    return this;
  }

  userId(userId: string) {
    this._props.user = ref(User, userId);
    return this;
  }

  code(code: string) {
    this._props.code = code;
    return this;
  }

  consumed(isConsumed: boolean) {
    this._props.isConsumed = isConsumed;
    return this;
  }

  build() {
    const memberCode = new MemberCode();
    Object.assign(memberCode, this._props);

    return memberCode;
  }
}
