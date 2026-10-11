/**
 * QUOI     — la politique de confidentialité de Runes de Chêne (RGPD art. 13 et 14) : Explore,
 *            la boutique et le Hub, puisqu'un compte Explore est aussi un compte client
 *            (Uriel, 11/10).
 * POURQUOI — dire, en clair, ce qu'on garde, pourquoi, combien de temps, qui le voit, et comment
 *            exercer ses droits. Chaque ligne décrit ce que le code fait vraiment (audit du 11/10) :
 *            changer le code, c'est relire ce texte.
 */
import { Link } from 'react-router'
import { PageLegale } from './PageLegale'

export function Confidentialite() {
  return (
    <PageLegale titre="Politique de confidentialité" chemin="/legal/confidentialite">
      <p>
        Runes de Chêne fait porter l’Histoire, et la fait explorer. Pour cela, nous gardons le moins
        de choses possible sur toi, et seulement ce qui sert. Voici lesquelles, pourquoi, combien de
        temps, et comment en décider.
      </p>

      <h2>Qui en est responsable</h2>
      <p>
        Uriel Lahoussaye, entrepreneur individuel (LAHOUSSAYE EI, Runes de Chêne), 421 chemin du
        Baudaric, Bâtiment RUOS, 06390 Contes, France — SIRET 844 256 537 00011. Pour toute question
        sur tes données : <a href="mailto:contact@runesdechene.com">contact@runesdechene.com</a>.
      </p>

      <h2>Un seul compte, pour Explore et pour la boutique</h2>
      <p>
        Ton compte Explore et ton compte client de la boutique runesdechene.com sont liés par ton
        adresse e-mail. Quand tu achètes un vêtement, la boutique nous transmet ta commande pour
        débloquer dans Explore le Fragment que tu portes. Les paiements, eux, sont traités par
        Shopify et ses prestataires : nous ne voyons jamais ta carte bancaire.
      </p>

      <h2>Ce que nous gardons</h2>
      <h3>Ton compte</h3>
      <ul>
        <li>
          ton adresse e-mail, pour te connecter (par un code reçu par e-mail : pas de mot de passe)
          ;
        </li>
        <li>
          ce que tu choisis de montrer sur ton profil : ton nom d’Explorateur, ta photo, ta
          présentation, ton Instagram ;
        </li>
        <li>
          tes préférences (notifications, calendrier, affichage) et la date à laquelle tu as accepté
          la Charte et ces textes.
        </li>
      </ul>
      <h3>Ce que tu fais dans Explore</h3>
      <ul>
        <li>
          les lieux que tu ajoutes ou enrichis : leur nom, leur position, leurs photos, leur récit ;
        </li>
        <li>
          tes visites (le lieu et la date seulement), tes découvertes, tes envies, tes cœurs, tes
          réponses aux énigmes, tes titres et tes Fragments ;
        </li>
        <li>
          tes mots dans les carnets de passage et dans les Compagnies, et tes Murmures (les messages
          privés entre deux Explorateurs).
        </li>
      </ul>
      <h3>Ta position</h3>
      <p>
        Seulement si tu l’autorises, et seulement quand Explore est ouverte. Elle sert à vérifier
        que tu es bien sur place quand tu marques une visite, et, si tu le choisis dans les
        Préférences (« Apparaître sur la carte »), à te montrer aux autres Explorateurs. Nous ne
        gardons que ta dernière position et son heure, jamais un historique de tes trajets ; «
        Brouiller les pistes » la rend volontairement approximative. Quand tu ajoutes une photo, sa
        position est lue sur ton téléphone pour la placer, puis retirée du fichier avant l’envoi.
      </p>
      <h3>Tes achats</h3>
      <p>
        Le numéro de ta commande, sa date, les produits achetés et ton adresse e-mail, pour
        débloquer tes Fragments. La boutique garde ta commande complète (adresse de livraison,
        facture) comme la loi l’impose à un commerçant.
      </p>
      <h3>Tes photos envoyées à la boutique</h3>
      <p>
        Si tu nous envoies une photo de toi avec un vêtement (le Studio, le mur « Ils nous portent
        »), nous gardons ce que tu remplis : ton nom, ton e-mail, ton Instagram, ta ville, ton avis,
        et, si tu le veux bien, ta taille et ta carrure pour conseiller les autres. Nous ne publions
        ta photo que si tu l’as accepté en l’envoyant.
      </p>
      <h3>Les notifications et les e-mails</h3>
      <ul>
        <li>
          si tu les acceptes, l’abonnement de ton appareil aux notifications : tu les coupes dans
          les Préférences ou dans les réglages de ton téléphone ;
        </li>
        <li>
          les e-mails nécessaires au service (ton code de connexion, une récompense, une réponse) ;
        </li>
        <li>
          la lettre de Runes de Chêne (nouveaux Fragments, ventes privées) seulement si tu l’as
          demandée ; chaque lettre se désabonne en un clic.
        </li>
      </ul>
      <h3>Ce que nous ne faisons pas</h3>
      <p>
        Aucune publicité, aucun traceur publicitaire, aucun outil de mesure d’audience, aucune
        revente de données. Seules quelques informations techniques servent au bon fonctionnement :
        le système de ton appareil et la date de ta dernière connexion.
      </p>

      <h2>Pourquoi, et sur quelle base</h2>
      <ul>
        <li>
          <strong>Faire fonctionner ton compte, Explore et tes Fragments</strong> : c’est le service
          que tu demandes en t’inscrivant (exécution des{' '}
          <Link to="/legal/conditions">conditions d’utilisation</Link>).
        </li>
        <li>
          <strong>Ta position, les notifications, la lettre, la publication de tes photos</strong> :
          ton consentement, que tu retires quand tu veux.
        </li>
        <li>
          <strong>La sécurité, la modération, la lutte contre les abus</strong> : notre intérêt
          légitime à garder Explore sûr pour tous.
        </li>
        <li>
          <strong>Tes commandes et leurs factures</strong> : nos obligations légales de commerçant.
        </li>
      </ul>

      <h2>Qui les voit</h2>
      <ul>
        <li>
          <strong>Tout le monde</strong>, y compris les visiteurs sans compte et les moteurs de
          recherche : les lieux publics, leurs photos et leurs récits, avec le nom et la photo de
          profil de qui les a ajoutés.
        </li>
        <li>
          <strong>Les Explorateurs</strong> : ton profil, tes lieux, tes titres, tes mots publics,
          ta position si tu l’as choisi ; tes envies seulement si tu les montres.
        </li>
        <li>
          <strong>La personne à qui tu écris un Murmure</strong>, et elle seule.
        </li>
        <li>
          <strong>L’équipe de Runes de Chêne</strong>, dans son outil interne (le Hub), réservé à
          quelques personnes nommément autorisées : pour t’aider, rattacher un achat, modérer.
        </li>
      </ul>
      <p>
        Et nos prestataires, chacun pour sa tâche et sous contrat, sans droit de réutiliser tes
        données :
      </p>
      <ul>
        <li>Supabase (base de données, serveurs en Irlande) ;</li>
        <li>Netlify (hébergement de l’application) ;</li>
        <li>
          Google (Firebase), qui héberge encore une partie des photos les plus anciennes, le temps
          que nous les rapatriions ;
        </li>
        <li>Shopify (la boutique et ses paiements, la lettre d’information) ;</li>
        <li>Resend (l’envoi des e-mails) ;</li>
        <li>Google, Apple et Mozilla (l’acheminement des notifications vers ton appareil) ;</li>
        <li>
          OpenFreeMap et Esri (les fonds de carte) et OpenStreetMap (les adresses), qui reçoivent ce
          que tout site reçoit pour afficher une carte : l’adresse IP de ton appareil et la zone
          regardée ;
        </li>
        <li>
          Anthropic, qui rédige les descriptions des pages publiques à partir des textes publics des
          lieux, sans aucune donnée de compte.
        </li>
      </ul>
      <p>
        Certains sont établis aux États-Unis. Ces transferts sont encadrés par le Cadre de
        protection des données UE–États-Unis ou par les clauses contractuelles types de la
        Commission européenne.
      </p>

      <h2>Combien de temps</h2>
      <ul>
        <li>
          <strong>Ton compte et ce qui s’y rattache</strong> : tant qu’il existe. Tu peux le
          supprimer à tout moment.
        </li>
        <li>
          <strong>Après la suppression</strong> : tes données personnelles sont effacées aussitôt
          (elles disparaissent aussi de nos sauvegardes techniques, sous trente jours). Les lieux,
          photos et récits que tu as ajoutés, et tes mots dans les carnets et les Compagnies,
          restent pour les autres, signés « Un Voyageur » : plus rien ne les relie à toi. Tes
          Murmures sont effacés.
        </li>
        <li>
          <strong>Tes commandes</strong> : dix ans, comme la loi l’impose pour les pièces
          comptables.
        </li>
        <li>
          <strong>La lettre d’information</strong> : jusqu’à ce que tu t’en désabonnes.
        </li>
      </ul>

      <h2>Tes droits</h2>
      <p>
        Tu peux accéder à tes données, les corriger, les effacer, les emporter, t’opposer à un
        traitement ou demander qu’il soit limité, retirer un consentement, et dire ce que tu veux
        qu’il advienne de tes données après ton décès. Dans l’appli, sans rien demander à personne :
      </p>
      <ul>
        <li>tes informations se corrigent sur ton profil et dans les Préférences ;</li>
        <li>
          « Télécharger mes données » (Préférences, « Tes données ») te donne tout, dans un fichier
          ;
        </li>
        <li>« Supprimer mon compte », au même endroit, efface ton compte Explore.</li>
      </ul>
      <p>
        Pour le reste, et pour ton compte client de la boutique, écris à{' '}
        <a href="mailto:contact@runesdechene.com">contact@runesdechene.com</a> : nous répondons sous
        un mois. Si tu estimes que nous ne respectons pas tes droits, tu peux saisir la CNIL
        (cnil.fr, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07).
      </p>

      <h2>Les plus jeunes</h2>
      <p>
        Explore s’adresse aux personnes de quinze ans et plus. Avant quinze ans, il faut l’accord
        d’un parent, qui peut nous écrire à tout moment pour faire supprimer le compte.
      </p>

      <h2>Cookies et stockage</h2>
      <p>
        Explore n’utilise aucun cookie publicitaire ni de mesure d’audience. Elle garde sur ton
        appareil ce qui lui est strictement nécessaire : ta session, tes réglages et une copie des
        écrans pour s’ouvrir vite, même hors connexion. Aucun consentement n’est demandé pour ce
        stockage, puisqu’il ne sert qu’au service que tu utilises.
      </p>

      <h2>Sécurité</h2>
      <p>
        Les échanges sont chiffrés, l’accès aux données est limité à ce que chacun doit voir, et
        nous ne gardons aucun mot de passe : la connexion se fait par un code envoyé à ton adresse.
      </p>

      <h2>Quand ce texte change</h2>
      <p>
        Nous te le disons dans l’appli, et te demandons de l’accepter à nouveau avant de continuer.
        La date de la version est en haut de la page.
      </p>
    </PageLegale>
  )
}
