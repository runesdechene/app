import { ISnapshottable } from '../../libs/shared/snapshot.js';

type Snapshot = {
  issuedAt: Date;
  expiresAt: Date;
  value: string;
};

export class Token implements ISnapshottable<Snapshot> {
  constructor(
    private readonly _issuedAt: Date,
    private readonly _expiresAt: Date,
    private readonly _value: string,
  ) {}

  snapshot(): Snapshot {
    return {
      issuedAt: this._issuedAt,
      expiresAt: this._expiresAt,
      value: this._value,
    };
  }

  value() {
    return this._value;
  }

  issuedAt() {
    return this._issuedAt;
  }

  expiresAt() {
    return this._expiresAt;
  }
}
