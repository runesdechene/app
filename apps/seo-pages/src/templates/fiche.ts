/**
 * QUOI     — la fiche du lieu, comme dans l'appli (Figma 229:128) : les vignettes, le nom, la
 *            nature et le département, l'époque, l'adresse, les Explorateurs ; le bouton qui
 *            ouvre son aperçu sur la carte ; « À propos » ; les rubriques pratiques ; qui l'a
 *            ajouté. Téléphone : une colonne. Ordinateur : le bouton et les rubriques à droite.
 * POURQUOI — Uriel, 11/10 : la page publique au style de la V2, et un seul appel — l'aperçu du
 *            lieu sur la carte des visiteurs, sans compte, que l'inscription retient.
 * ATTENTION — chaque morceau est écrit une fois : la grille (global.css) les range en une ou
 *            deux colonnes.
 */
import type { Place } from '../lib/places';
import type { Fiche, Personne } from '../lib/fiche';
import { aLaTaille, dateFr, echapper, paragraphes, region } from '../lib/texte';

const NOMBRE = new Intl.NumberFormat('fr-FR');

function portrait(p: Personne): string {
  return p.avatar
    ? `<img class="portrait" src="${echapper(aLaTaille(p.avatar, 22))}" alt="" width="22" height="22" loading="lazy" />`
    : `<span class="portrait" aria-hidden="true">${echapper(p.nom.charAt(0).toUpperCase())}</span>`;
}

function explorateurs(e: Fiche['explorateurs']): string {
  const phrase =
    e.nombre === 0
      ? 'Aucun Explorateur n’a encore foulé ce lieu'
      : e.nombre === 1
        ? '1 Explorateur a foulé ce lieu'
        : `${NOMBRE.format(e.nombre)} Explorateurs ont foulé ce lieu`;
  const portraits = e.derniers.slice(0, 3).map(portrait).join('');
  return `<p class="ligne pas">${portraits ? `<span class="portraits">${portraits}</span>` : ''}${phrase}</p>`;
}

function pratique(f: Fiche): string {
  const rubriques: [string, string | null][] = [
    ['Accès', f.rubriques.acces],
    ['Quand y aller', f.rubriques.quand],
    ['Bon à savoir', f.rubriques.bonASavoir],
    ['Bivouac', f.bivouacTolere ? 'Bivouac toléré' : null],
  ];
  const remplies = rubriques.filter((r): r is [string, string] => Boolean(r[1]?.trim()));
  if (remplies.length === 0) return '';
  return `<section class="pratique" aria-label="Infos pratiques">
    ${remplies.map(([titre, texte]) => `<h3>${titre}</h3>${paragraphes(texte)}`).join('\n')}
  </section>`;
}

export function renderFiche(input: {
  place: Place;
  fiche: Fiche;
  recit: string | null;
  numeros: Map<string, string>;
  nombreDeLieux: number;
}): string {
  const { place, fiche, recit, numeros, nombreDeLieux } = input;
  const ou = region(place.departement ?? place.pays, numeros);
  const faits = [fiche.faits.epoque, fiche.faits.annee ? String(fiche.faits.annee) : null].filter(Boolean).join(' · ');
  const nature = fiche.type
    ? `<span class="nature" style="--type:${echapper(fiche.type.couleur ?? '#9b3f39')}">${
        fiche.type.icone ? `<span class="icone" style="--icone:url('${echapper(fiche.type.icone)}')" aria-hidden="true"></span>` : ''
      }${echapper(fiche.type.nom)}</span>`
    : '';
  const vignettes = fiche.photos.slice(0, 6);

  return `<article class="fiche">
  <div class="entete">
    ${vignettes.length > 1 ? `<div class="vignettes">${vignettes
      .map((p, i) => `<button type="button" data-photo="${echapper(aLaTaille(p.url, 1440))}" aria-label="Photo ${i + 1}"><img src="${echapper(aLaTaille(p.vignette || p.url, 44))}" alt="" width="44" height="44" /></button>`)
      .join('')}</div>` : ''}
    <h1>${echapper(place.title)}</h1>
    <p class="nature-et-region">${nature}${ou ? `<span>${echapper(ou)}</span>` : ''}</p>
    ${faits ? `<p class="faits">${echapper(faits)}</p>` : ''}
    ${fiche.adresse ? `<p class="ligne epingle">${echapper(fiche.adresse)}</p>` : ''}
    ${explorateurs(fiche.explorateurs)}
  </div>

  <div class="appel">
    <p class="invitation">Ce lieu t’attend sur la carte d’Explore, avec ${NOMBRE.format(nombreDeLieux)} autres sortis de l’oubli.</p>
    <a class="bouton" href="/bienvenue/carte/lieu/${echapper(place.id)}">Découvrir ce lieu sur la carte</a>
    <p class="gratuit">Gratuit, sans compte · offert par Runes de Chêne</p>
  </div>

  ${recit ? `<section class="a-propos"><h2>À propos</h2>${paragraphes(recit)}</section>` : ''}
  ${pratique(fiche)}

  ${fiche.auteur ? `<p class="credit">${portrait(fiche.auteur)}<span>Lieu ajouté par <strong>${echapper(fiche.auteur.nom)}</strong>${fiche.ajouteLe ? ` · le ${dateFr(fiche.ajouteLe)}` : ''}</span></p>` : ''}
</article>
${vignettes.length > 1 ? `<script>
  for (const b of document.querySelectorAll('.vignettes button')) {
    b.addEventListener('click', () => { document.getElementById('photo-du-lieu').src = b.dataset.photo; });
  }
</script>` : ''}`;
}
