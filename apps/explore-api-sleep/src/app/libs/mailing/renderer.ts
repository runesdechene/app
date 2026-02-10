export interface IEmailRenderer<Props> {
  render(props: Props): Promise<string>;
}
