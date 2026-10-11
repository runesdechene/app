/**
 * QUOI     — « Vous pourriez aussi aimer » (Uriel, 11/10, plutôt qu'« À proximité ») : les quatre
 *            lieux les plus proches, comme les lieux de la vitrine
 *            (la photo, la nature posée dessus, le nom, le département et la distance).
 * POURQUOI — Google suit ces liens de fiche en fiche ; le visiteur, lui, voit quoi faire autour.
 */
import type { NearbyPlace } from '../lib/places';
import { aLaTaille, echapper, region } from '../lib/texte';

function distance(km: number): string {
  return km < 1 ? 'à moins d’un km' : `à ${Math.round(km)} km`;
}

export function renderProximite(lieux: NearbyPlace[], numeros: Map<string, string>): string {
  if (lieux.length === 0) return '';
  return `<section class="proximite" aria-labelledby="a-proximite">
  <h2 id="a-proximite">Vous pourriez aussi aimer</h2>
  <ul>
    ${lieux
      .map((l) => {
        const photo = l.images[0]?.url;
        const tag = l.primaryTag;
        const ou = region(l.region, numeros);
        return `<li><a href="/lieu/${echapper(l.slug)}">
      <span class="cadre">
        ${photo ? `<img src="${echapper(aLaTaille(photo, 300))}" alt="" loading="lazy" />` : ''}
        ${tag ? `<span class="nature" style="--type:${echapper(tag.color || '#9b3f39')}">${
          tag.icon ? `<span class="icone" style="--icone:url('${echapper(tag.icon)}')" aria-hidden="true"></span>` : ''
        }${echapper(tag.title)}</span>` : ''}
      </span>
      <span class="nom">${echapper(l.title)}</span>
      <span class="ou">${ou ? `${echapper(ou)} · ` : ''}${distance(l.distanceKm)}</span>
    </a></li>`;
      })
      .join('\n')}
  </ul>
</section>`;
}
