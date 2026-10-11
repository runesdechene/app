/**
 * QUOI     — les mentions légales (LCEN, art. 6 III) : qui édite, qui héberge, à qui écrire.
 * POURQUOI — obligatoires pour tout site professionnel. L'éditeur est une entreprise
 *            individuelle : nom, adresse, téléphone et immatriculation sont dus (Uriel, 11/10 :
 *            le numéro des CGV de la boutique).
 */
import { Link } from 'react-router'
import { PageLegale } from './PageLegale'

export function Mentions() {
  return (
    <PageLegale titre="Mentions légales" chemin="/legal/mentions">
      <h2>Éditeur</h2>
      <p>
        Explore (app.runesdechene.com) et la boutique runesdechene.com sont édités par Uriel
        Lahoussaye, entrepreneur individuel (LAHOUSSAYE EI), sous le nom commercial Runes de Chêne.
      </p>
      <ul>
        <li>Adresse : 421 chemin du Baudaric, Bâtiment RUOS, 06390 Contes, France</li>
        <li>Immatriculation : RCS de Nice, SIRET 844 256 537 00011</li>
        <li>Téléphone : 06 19 93 43 28</li>
        <li>
          E-mail : <a href="mailto:contact@runesdechene.com">contact@runesdechene.com</a>
        </li>
        <li>Directeur de la publication : Uriel Lahoussaye</li>
      </ul>

      <h2>Hébergement</h2>
      <p>
        L’application et ses pages sont hébergées par Netlify, Inc., 101 2nd Street, San Francisco,
        CA 94105, États-Unis (netlify.com).
      </p>
      <p>
        Les données des comptes sont hébergées par Supabase, Inc., 3500 S. DuPont Highway, Dover, DE
        19901, États-Unis (supabase.com), sur des serveurs situés en Irlande, dans l’Union
        européenne.
      </p>
      <p>
        La boutique est hébergée par Shopify International Limited, Victoria Buildings, 1-2
        Haddington Road, Dublin 4, D04 XN32, Irlande (shopify.com).
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Runes de Chêne est une marque déposée. Les illustrations, les Fragments, les textes, le logo
        et l’apparence d’Explore appartiennent à Runes de Chêne : toute reproduction sans accord
        écrit est interdite. Ce que les Explorateurs publient reste à leurs auteurs, dans les
        conditions des <Link to="/legal/conditions">conditions d’utilisation</Link>.
      </p>
      <p>
        Les fonds de carte viennent d’OpenStreetMap (© les contributeurs d’OpenStreetMap, licence
        ODbL), servis par OpenFreeMap, et, pour la vue satellite, d’Esri et de ses fournisseurs.
      </p>

      <h2>Signaler un contenu</h2>
      <p>
        Un lieu, une photo, un texte ou un message te semble illicite ? Signale-le depuis l’appli («
        Signaler » sur la fiche d’un lieu ou d’une énigme), ou écris à{' '}
        <a href="mailto:contact@runesdechene.com">contact@runesdechene.com</a> en précisant
        l’adresse de la page, le contenu en cause et la raison. Nous répondons au plus vite et
        retirons ce qui doit l’être.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Tout est dans la <Link to="/legal/confidentialite">politique de confidentialité</Link>.
      </p>
    </PageLegale>
  )
}
