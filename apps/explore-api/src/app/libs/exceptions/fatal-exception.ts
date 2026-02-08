export class FatalException extends Error {
  public readonly code: string;
  public readonly payload: Record<string, any>;

  constructor(props: {
    code: string;
    message: string;
    payload: Record<string, any>;
  }) {
    super(props.message);
    this.code = props.code;
    this.payload = props.payload;
  }
}
