import { MJMLRenderer } from '../../libs/mailing/mjml-renderer.js';
import { ITranslator } from '../../libs/i18n/translator.js';
import { Lang } from '../../libs/i18n/lang.js';

type Props = {
  lang: Lang;
  callbackUrl: string;
};

export class RegisteredEmail extends MJMLRenderer<Props> {
  constructor(private readonly translator: ITranslator) {
    super();
  }

  template(props: Props) {
    return /* xml */ `
      <mjml>
        ${this.head()}
        <mj-body>
          <mj-section>
            <mj-column>
              ${this.intro({
                subject: this.translator.translate(
                  'password-reset.begin.subject',
                  props.lang,
                ),
              })}
              ${this.text({
                children: this.translator.translate(
                  'password-reset.begin.text',
                  props.lang,
                  {
                    callbackUrl: props.callbackUrl,
                  },
                ),
              })}
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;
  }
}
