import { MJMLRenderer } from '../../libs/mailing/mjml-renderer.js';
import { User } from '../../domain/entities/user.js';
import { Place } from '../../domain/entities/place.js';

type Props = {
  author: User;
  place: Place;
  message: string;
};

export class ReportEmail extends MJMLRenderer<Props> {
  template(props: Props) {
    const place = props.place;
    const author = props.author;

    return /* xml */ `
      <mjml>
        ${this.head()}
        <mj-body>
          <mj-section>
            <mj-column>
             ${this.intro({
               subject: 'Nouveau Signalement',
             })}
             ${this.text({
               children: [
                 'Un nouveau signalement a été effectué pour le lieu suivant :',
                 `ID : ${place.id}`,
                 `Auteur : ${author.emailAddress}`,
                 `Titre du lieu : ${place.title}`,
                 `Retour effectué : ${props.message}`,
               ].join('\n'),
             })}
    
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `;
  }
}
