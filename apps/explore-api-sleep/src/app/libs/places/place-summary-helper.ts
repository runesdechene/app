import { AuthContext } from '../../domain/model/auth-context.js';
import { Place } from '../../domain/entities/place.js';
import { PlaceBookmarked } from '../../domain/entities/place-bookmarked.js';
import { ApiPlaceSummary } from '../../application/viewmodels/api-place-summary.js';
import { EntityManager } from '@mikro-orm/postgresql';
import { PlaceLiked } from '../../domain/entities/place-liked.js';
import { PlaceExplored } from '../../domain/entities/place-explored.js';

export class PlaceSummaryHelper {
  constructor(private readonly em: EntityManager) {}

  async map(
    result: any,
    auth?: AuthContext,
    extraMeta?: boolean,
  ): Promise<ApiPlaceSummary> {
    const place = result.place_data;
    const placeType = result.place_type;
    const score = result.avg_score;
    const formattedNote = score ? Number(score) : undefined;

    return {
      id: place.id,
      title: place.title,
      imageUrl: place.images.length > 0 ? place.images[0].url : null,
      type: placeType,
      location: {
        latitude: place.latitude,
        longitude: place.longitude,
      },
      requester: auth ? await this.requester(auth, place) : null,
      avg_score: formattedNote,
      url: extraMeta ? place.text : undefined,
    };
  }

  async makeQuery({
    content,
    count,
    start,
    args,
  }: {
    content: string;
    count: number;
    start: number;
    args?: any[];
  }): Promise<any[]> {
    return this.em.execute(
      `
          SELECT ROW_TO_JSON(p)  AS place_data,
                 ROW_TO_JSON(pt) AS place_type
          FROM places as p
                   LEFT JOIN place_types AS pt ON pt.id = p.place_type_id
              ${content}
          ORDER BY p.created_at DESC
          LIMIT ? OFFSET ?;
      `,
      [...(args ?? []), count, start],
    );
  }

  private async requester(auth: AuthContext, place: Place) {
    const bookmark = await this.em
      .createQueryBuilder(PlaceBookmarked)
      .where({
        place: place.id,
        user: auth.id(),
      })
      .getSingleResult();

    const liked = await this.em
      .createQueryBuilder(PlaceLiked)
      .where({
        place: place.id,
        user: auth.id(),
      })
      .getSingleResult();

    const explored = await this.em
      .createQueryBuilder(PlaceExplored)
      .where({
        place: place.id,
        user: auth.id(),
      })
      .getSingleResult();

    return {
      bookmarked: !!bookmark,
      liked: !!liked,
      explored: !!explored,
    };
  }
}
