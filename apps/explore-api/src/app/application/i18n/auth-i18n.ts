import { Lang } from '../../libs/i18n/lang.js';

export type AuthI18N =
  | 'password-reset.begin.subject'
  | 'password-reset.begin.text'
  | 'password-reset.end.subject'
  | 'password-reset.end.text';

export const authI18n: Record<Lang, Record<AuthI18N, string>> = {
  ['fr']: {
    'password-reset.begin.subject': 'Réinitialisation du mot de passe',
    'password-reset.begin.text': `
      Vous recevez cet e-mail car vous avez commencé une réinitialisation de mot de passe.<br />
      Pour continuer, entrez le code suivant : <b>{code}</b>
    `,

    'password-reset.end.subject': 'Mot de passe mis à jour',
    'password-reset.end.text': `
      Votre mot de passe a été mis à jour.
    `,
  },
};
