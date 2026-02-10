export class BadRequestException extends Error {
  public readonly code: string;

  static create(code: string, message: string) {
    return new BadRequestException({ code, message });
  }

  constructor(props: { code: string; message: string }) {
    super(props.message);
    this.code = props.code;
  }
}
