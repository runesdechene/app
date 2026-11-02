/**
 * QUOI     — écrire le contenu d'un motif dans son métaobjet Illustration de Shopify : la préhistoire
 *            (« En bref »), le mot de l'artiste, la marque d'édition et sa précision.
 * POURQUOI — on écrit dans le Hub, ça vit dans Shopify (Uriel, 02/11) : la fiche produit de la boutique
 *            et l'appli lisent les mêmes champs, la synchro les ramène en base. Une seule source.
 * ATTENTION — les champs doivent exister dans la définition « illustrations » (Contenu → Métaobjets) :
 *            sinon Shopify répond par un userErrors, remonté tel quel. Le proxy n'accepte qu'une requête
 *            sans variables : chaque valeur est écrite en littéral JSON, qu'une chaîne GraphQL accepte.
 */
import { graphqlShopify } from './shopify'

export type ContenuMotif = {
  resume: string
  mot_de_l_artiste: string
  edition: '' | 'limitee' | 'retire' | 'exclusif'
  edition_precision: string
}

type Reponse = { metaobjectUpsert: { userErrors: { field: string[] | null; message: string }[] } }

export async function ecrireContenuMotif(handle: string, contenu: ContenuMotif): Promise<void> {
  const champs = Object.entries(contenu)
    .map(([cle, valeur]) => `{ key: ${JSON.stringify(cle)}, value: ${JSON.stringify(valeur)} }`)
    .join(', ')
  const requete = `mutation {
    metaobjectUpsert(handle: { type: "illustrations", handle: ${JSON.stringify(handle)} }, metaobject: { fields: [${champs}] }) {
      userErrors { field message }
    }
  }`
  const { metaobjectUpsert } = await graphqlShopify<Reponse>(requete)
  const erreur = metaobjectUpsert.userErrors[0]
  if (erreur) throw new Error(erreur.message)
}
