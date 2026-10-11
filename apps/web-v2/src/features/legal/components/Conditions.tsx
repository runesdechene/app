/**
 * QUOI     — les conditions d'utilisation d'Explore : ce qu'est le service, les règles de la
 *            communauté (la Charte), ce que tu publies, la prudence sur le terrain, la
 *            modération, le droit applicable.
 * POURQUOI — elles s'acceptent à l'inscription (case à cocher) et à chaque nouvelle version
 *            (Uriel, 11/10). Explore mène vers des lieux réels, parfois fragiles ou dangereux :
 *            les règles du terrain (code du patrimoine, propriété privée) y ont leur place.
 */
import { Link } from 'react-router'
import { PageLegale } from './PageLegale'

export function Conditions() {
  return (
    <PageLegale titre="Conditions d’utilisation" chemin="/legal/conditions">
      <p>
        Ces conditions règlent l’usage d’Explore, la carte des lieux d’Histoire et de Nature offerte
        par Runes de Chêne (LAHOUSSAYE EI, voir les{' '}
        <Link to="/legal/mentions">mentions légales</Link>
        ). En créant ton compte, tu les acceptes, ainsi que la{' '}
        <Link to="/legal/confidentialite">politique de confidentialité</Link>. Les achats sur la
        boutique suivent, eux, les conditions générales de vente de runesdechene.com.
      </p>

      <h2>1. Le service</h2>
      <p>
        Explore est gratuite. Elle permet de découvrir, visiter, ajouter et raconter des lieux,
        d’échanger avec d’autres Explorateurs, de rejoindre des Compagnies, de résoudre des énigmes
        et de faire vivre les Fragments achetés sur la boutique. Nous la faisons évoluer, et pouvons
        en changer, suspendre ou arrêter une fonction ; nous faisons de notre mieux pour qu’elle
        reste disponible, sans pouvoir le garantir à tout instant.
      </p>

      <h2>2. Ton compte</h2>
      <ul>
        <li>Il faut avoir quinze ans, ou l’accord d’un parent avant cet âge.</li>
        <li>
          Un compte, c’est une personne, avec une adresse e-mail qui est la sienne : il ne se prête
          ni ne se vend. Il est aussi ton compte client de la boutique.
        </li>
        <li>Tu te connectes par un code envoyé à ton adresse : garde ta boîte e-mail pour toi.</li>
        <li>
          Tu peux supprimer ton compte à tout moment, depuis les Préférences (« Tes données »).
        </li>
      </ul>

      <h2>3. La Charte</h2>
      <p>Explore est une confrérie. Chaque Explorateur s’y engage :</p>
      <ul>
        <li>
          <strong>Respect des découvertes</strong> — chaque porteur protège les lieux à sa façon. Il
          n’abîme rien, et agit pour le préserver.
        </li>
        <li>
          <strong>Respect des peuples</strong> — des cultures et de leur droit de subsister et de
          décider d’eux-mêmes.
        </li>
        <li>
          <strong>On dit vrai</strong> — ce qu’on raconte d’un lieu, on sait d’où on le tient. Une
          légende se présente comme une légende. Un doute, on le marque.
        </li>
        <li>
          <strong>Certains lieux se taisent</strong> — un site fragile ou menacé ne se partage pas
          en mode Public : on préfère « Porteurs seulement ».
        </li>
        <li>
          <strong>Un visage n’est pas un décor</strong> — on demande avant de photographier
          quelqu’un, et avant de publier sa photo.
        </li>
        <li>
          <strong>Camaraderie et bienveillance</strong> — on se salue, on s’entraide, on se corrige
          avec égards.
        </li>
      </ul>

      <h2>4. Ce qui est interdit</h2>
      <ul>
        <li>
          publier un contenu illicite, haineux, violent, pornographique, diffamatoire, ou qui
          harcèle, menace ou expose quelqu’un (son adresse, sa photo, sa vie privée) ;
        </li>
        <li>
          publier ce qui ne t’appartient pas : la photo ou le texte d’un autre sans son accord ;
        </li>
        <li>
          pousser à dégrader un lieu, à y fouiller ou à y prélever quoi que ce soit : la recherche
          d’objets archéologiques, y compris au détecteur de métaux, est interdite sans autorisation
          de l’État (code du patrimoine, art. L. 542-1) ;
        </li>
        <li>
          se faire passer pour quelqu’un d’autre, créer des comptes en série, tromper le jeu ou
          tenter d’accéder à ce qui ne t’est pas ouvert ;
        </li>
        <li>faire de la publicité ou démarcher les autres Explorateurs.</li>
      </ul>

      <h2>5. Ce que tu publies</h2>
      <p>
        Tu restes l’auteur de tes photos, de tes récits et de tes mots, et tu garantis en avoir le
        droit. Pour que la carte vive, tu accordes à Runes de Chêne, gratuitement, pour le monde
        entier et pour toute la durée des droits, le droit de les afficher, de les reproduire, de
        les adapter à l’écran (recadrer, réduire, traduire) et de les diffuser dans Explore, sur ses
        pages publiques et sur les supports de Runes de Chêne qui parlent de la carte. Si tu
        supprimes ton compte, les lieux, photos et récits que tu as ajoutés restent sur la carte
        pour les autres, signés « Un Voyageur ».
      </p>
      <p>
        Les récits d’un lieu s’écrivent à plusieurs : d’autres Explorateurs peuvent compléter ou
        corriger ce que tu as écrit, et l’équipe veille à ce qui est publié.
      </p>

      <h2>6. Sur le terrain</h2>
      <p>
        Explore mène vers des lieux réels : ruines, forêts, sommets, sites anciens. Ils peuvent être
        dangereux, fermés, protégés ou privés. Les informations de la carte viennent des
        Explorateurs : elles peuvent être inexactes ou dépassées, et ne valent pas autorisation
        d’entrer. Sur place, tu restes seul juge de ta sécurité et responsable de toi :
      </p>
      <ul>
        <li>respecte les propriétés privées, les clôtures, les interdictions et les horaires ;</li>
        <li>
          respecte les règles des sites protégés et des espaces naturels (bivouac, feu, cueillette)
          ;
        </li>
        <li>ne prends pas de risques : la pierre ancienne s’effrite, le terrain trompe.</li>
      </ul>
      <p>
        Runes de Chêne ne peut être tenue responsable d’un accident, d’un dommage ou d’une
        infraction commis lors d’une sortie.
      </p>

      <h2>7. Fragments, Couronnes et titres</h2>
      <p>
        Les Fragments débloqués par un achat, les Couronnes, les titres et les niveaux sont des
        éléments du jeu : ils n’ont aucune valeur en argent, ne s’échangent pas et ne se transfèrent
        pas d’un compte à l’autre.
      </p>

      <h2>8. Modération</h2>
      <p>
        Chacun peut signaler un contenu depuis l’appli, ou à{' '}
        <a href="mailto:contact@runesdechene.com">contact@runesdechene.com</a>. L’équipe peut
        retirer un contenu contraire à ces conditions ou à la loi, et, après un avertissement — ou
        sans attendre si c’est grave —, suspendre ou fermer le compte de qui ne les respecte pas.
        Elle te dit pourquoi, et tu peux lui répondre.
      </p>

      <h2>9. Quand ces conditions changent</h2>
      <p>
        Nous te prévenons dans l’appli, et tu acceptes la nouvelle version pour continuer. Si tu ne
        l’acceptes pas, tu peux supprimer ton compte.
      </p>

      <h2>10. Droit applicable</h2>
      <p>
        Ces conditions sont soumises au droit français. En cas de désaccord, écris-nous d’abord :
        nous chercherons ensemble une solution. À défaut, les tribunaux français sont compétents,
        dans le respect des règles qui protègent le consommateur.
      </p>
    </PageLegale>
  )
}
