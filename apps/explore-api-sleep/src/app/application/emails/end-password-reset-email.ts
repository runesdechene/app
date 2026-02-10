import { Lang } from '../../libs/i18n/lang.js';
import { MJMLRenderer } from '../../libs/mailing/mjml-renderer.js';
import { ITranslator } from '../../libs/i18n/translator.js';

type Props = {
  lang: Lang;
};

export class EndPasswordResetEmail extends MJMLRenderer<Props> {
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
                  'password-reset.end.subject',
                  props.lang,
                ),
              })}

              ${this.text({
                children: this.translator.translate(
                  'password-reset.end.text',
                  props.lang,
                ),
              })}
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;
  }
}
