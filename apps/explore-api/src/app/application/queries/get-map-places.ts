import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EntityManager } from '@mikro-orm/postgresql';
import z from 'zod';

import { PaginatedQuery } from '../../libs/shared/pagination.js';
import { BaseCommand } from '../../libs/shared/command.js';
import { Place } from '../../domain/entities/place.js';
import { AuthContext } from '../../domain/model/auth-context.js';
import { ApiPlaceMap } from '../viewmodels/api-place-map.js';
import { PlaceViewed } from '../../domain/entities/place-viewed.js';

type Payload = PaginatedQuery<
  | {
      type: 'all';
      latitude?: number;
      longitude?: number;
      latitudeDelta?: number;
      longitudeDelta?: number;
    }
  | {
      type: 'latest';
    }
  | {
      type: 'popular';
    }
>;

export class GetMapPlacesQuery extends BaseCommand<Payload> {
  validate(props: Payload): Payload {
    return z
      .object({
        params: z
          .union([
            z.object({
              type: z.literal('all'),
              latitude: z.number().optional(),
              latitudeDelta: z.number().optional(),
              longitude: z.number().optional(),
              longitudeDelta: z.number().optional(),
            }),
            z.object({
              type: z.literal('latest'),
            }),
            z.object({
              type: z.literal('popular'),
            }),
          ])
          .optional(),
        page: z.number().optional(),
        count: z.number().max(100).min(1).optional(),
      })
      .parse(props) as unknown as Payload;
  }
}

@QueryHandler(GetMapPlacesQuery)
export class GetMapPlacesQueryHandler
  implements IQueryHandler<GetMapPlacesQuery, ApiPlaceMap[]>
{
  constructor(private readonly em: EntityManager) {}

  async execute(query: GetMapPlacesQuery): Promise<ApiPlaceMap[]> {
    const props = query.props();

    let result: any[] = [];

    if (props.params?.type === 'popular') {
      result = await this.em.execute(
        `
            SELECT ROW_TO_JSON(p)  AS place_data,
                   ROW_TO_JSON(pt) AS place_type,
                   COUNT(pv.id)    AS views_count
            FROM places as p
                     LEFT JOIN places_viewed AS pv ON pv.place_id = p.id
                     LEFT JOIN place_types AS pt ON pt.id = p.place_type_id
            WHERE pt.hidden IS false
            GROUP BY p.id, pt.id
            ORDER BY views_count DESC
            LIMIT ?;
        `,
        [props.count ?? 100],
      );
    } else if (props.params?.type === 'latest') {
      result = await this.em.execute(
        `
            SELECT ROW_TO_JSON(p)  AS place_data,
                   ROW_TO_JSON(pt) AS place_type
            FROM places as p
                     LEFT JOIN place_types AS pt ON pt.id = p.place_type_id
            WHERE pt.hidden IS false
            ORDER BY p.created_at DESC
            LIMIT ?;
        `,
        [props.count ?? 100],
      );
    } else {
      let filtering = '';
      if (
        props.params?.latitude &&
        props.params?.longitude &&
        props.params?.latitudeDelta &&
        props.params?.longitudeDelta
      ) {
        const minLatitude = props.params.latitude - props.params.latitudeDelta;
        const maxLatitude = props.params.latitude + props.params.latitudeDelta;
        const minLongitude =
          props.params.longitude - props.params.longitudeDelta;
        const maxLongitude =
          props.params.longitude + props.params.longitudeDelta;
        filtering = `WHERE p.latitude>= ${minLatitude} AND p.latitude <= ${maxLatitude} AND p.longitude>= ${minLongitude} AND p.longitude <= ${maxLongitude} AND pt.hidden IS false`;
      }
      const requestSQL = `SELECT ROW_TO_JSON(p)  AS place_data,
                   ROW_TO_JSON(pt) AS place_type
            FROM places as p
                     LEFT JOIN place_types AS pt ON pt.id = p.place_type_id
            ${filtering}
            ORDER BY p.created_at`;
      result = await this.em.execute(requestSQL, []);
    }

    return await Promise.all(
      result.map(async (result): Promise<ApiPlaceMap> => {
        const place = result.place_data;
        const placeType = result.place_type;

        return {
          id: place.id,
          title: place.title,
          type: placeType,
          location: {
            latitude: place.latitude,
            longitude: place.longitude,
          },
          requester: query.auth()
            ? await this.requester(query.auth(), place)
            : null,
        };
      }),
    );
  }

  private async requester(auth: AuthContext, place: Place) {
    const viewed = await this.em
      .createQueryBuilder(PlaceViewed)
      .where({
        place: place.id,
        user: auth.id(),
      })
      .getSingleResult();

    return {
      viewed: !!viewed,
    };
  }
}
