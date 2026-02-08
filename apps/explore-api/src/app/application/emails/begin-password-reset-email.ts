import { MJMLRenderer } from '../../libs/mailing/mjml-renderer.js';
import { Lang } from '../../libs/i18n/lang.js';
import { ITranslator } from '../../libs/i18n/translator.js';

type Props = {
  lang: Lang;
  code: string;
};

export class BeginPasswordResetEmail extends MJMLRenderer<Props> {
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
                    code: props.code,
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
