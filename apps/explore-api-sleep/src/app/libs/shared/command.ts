import { ICommand, ICommandHandler } from '@nestjs/cqrs';
import { Nullable } from './types.js';
import { AuthContext } from '../../domain/model/auth-context.js';

export type HeadersDevice = { device_os: string; device_version: string };
export abstract class BaseCommand<TProps = void> implements ICommand {
  private readonly _auth: Nullable<AuthContext>;
  private readonly _props: TProps;
  private readonly _headers: HeadersDevice;

  constructor(
    auth: Nullable<AuthContext>,
    props: TProps,
    headers?: HeadersDevice,
  ) {
    this._auth = auth;
    this._props = this.validate(props);
    if (headers) {
      this._headers = {
        device_os: headers['device-os'],
        device_version: headers['device-version'],
      };
    }
  }

  validate(props: TProps): TProps {
    return props;
  }

  props() {
    return this._props;
  }

  getUserId() {
    if (this._auth === null) {
      throw new Error('Auth context is not available');
    }

    return this._auth.id();
  }

  auth() {
    if (this._auth === null) {
      throw new Error('Auth context is not available');
    }

    return this._auth;
  }

  headers() {
    if (this._headers === null) {
      throw new Error('Headers context is not available');
    }

    return this._headers;
  }
}

export abstract class BaseCommandHandler<
  TCommand extends ICommand = any,
  TResult = any,
> implements ICommandHandler<TCommand, TResult>
{
  abstract execute(command: TCommand): Promise<TResult>;
}
