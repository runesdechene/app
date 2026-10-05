/**
 * QUOI     — les clés de cache que deux zones partagent : les cœurs de la fiche d'un lieu, et le
 *            fil « Sur les chemins » de l'Accueil.
 * POURQUOI — depuis la migration 413, saluer un ajout dans le fil, c'est aimer le lieu : un cœur
 *            donné d'un côté doit faire relire l'autre. Les zones ne s'importent pas entre elles ;
 *            leurs clés communes vivent ici.
 */
export const cheminsKey = ['accueil', 'chemins'] as const
export const coeursDuLieuKey = (id: string) => ['lieu', id, 'coeurs'] as const
